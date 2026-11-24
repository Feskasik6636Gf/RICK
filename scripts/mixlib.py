"""Mix narration + library music/effects at fixed loudness targets. Everything quiet and supportive under the voice."""
import os, subprocess, re, numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))

def load(name):
    src = name if os.path.exists(name) else os.path.join(HERE, name); dst = src + '.48k.wav'   # cwd first, then this file's folder
    if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src): subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-ar', str(SR), '-ac', '2', dst], check=True)
    sr, a = wavfile.read(dst); a = a.astype(np.float32) / 32768
    return a if a.ndim == 2 else np.stack([a, a], 1)

def lufs(a):
    """Integrated loudness measured by ffmpeg (EBU R128)."""
    import tempfile; tmp = os.path.join(tempfile.gettempdir(), '_mixlib_lufs_tmp.wav'); wavfile.write(tmp, SR, (np.clip(a, -1, 1) * 32767).astype(np.int16))
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', tmp, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = re.findall(r'I:\s+(-?[0-9.]+) LUFS', out); return float(m[-1]) if m else -70.0

def fade(x, a, r):
    n = len(x); e = np.ones(n, np.float32); na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return x * e[:, None]

class Mix:
    def __init__(self, dur):
        self.N = int(dur * SR); self.music = np.zeros((self.N, 2), np.float32); self.fx = np.zeros((self.N, 2), np.float32); self.cache = {}
    def src(self, name):
        if name not in self.cache: a = load(name); self.cache[name] = (a, lufs(a))
        return self.cache[name]
    def add(self, name, at, target=-40.0, start=0.0, dur=None, fin=0.05, fout=0.3, loop=False, bus='fx', pan=0.0, rate=1.0):
        a, l = self.src(name); a = a[int(start * SR):]
        if rate != 1.0:
            idx = np.arange(0, len(a) - 1, rate); a = np.stack([np.interp(idx, np.arange(len(a)), a[:, c]) for c in range(2)], 1).astype(np.float32)
        if dur is not None:
            n = int(dur * SR)
            if loop and len(a) < n: a = np.concatenate([a] * (n // len(a) + 1))
            a = a[:n]
        a = fade(a, fin, fout) * (10 ** ((target - l) / 20))
        if pan: a = a * np.array([min(1, 1 - pan), min(1, 1 + pan)], np.float32)
        i = int(at * SR); n = min(len(a), self.N - i)
        if n > 0: (self.music if bus == 'music' else self.fx)[i:i + n] += a[:n]
    def render(self, vo_wav, out, vo_target=-16.0, duck_db=8.0, end_fade=1.5):
        v = load(vo_wav)  # resampled to 48 kHz (a 44.1 kHz voice read raw plays 8.8 % fast)
        v = np.pad(v, ((0, max(0, self.N - len(v))), (0, 0)))[:self.N]
        v *= 10 ** ((vo_target - lufs(v)) / 20)
        env = np.abs(v).max(1); w = int(0.25 * SR); c = np.cumsum(np.concatenate([np.zeros(w), env, np.zeros(w)]))
        env = (c[w + w // 2: w + w // 2 + self.N] - c[w // 2: w // 2 + self.N]) / w; env = np.clip(env / 0.05, 0, 1)
        duck = 10 ** (-duck_db * env / 20)
        mix = v + self.music * duck[:, None] + self.fx * (10 ** (-3 * env / 20))[:, None]
        e = np.ones(self.N, np.float32); ne = int(end_fade * SR)
        if ne: e[-ne:] = np.linspace(1, 0, ne)
        mix *= e[:, None]
        mix *= 10 ** ((-15.0 - lufs(mix)) / 20)                       # whole piece at -15 LUFS
        lim = 10 ** (-1.5 / 20); over = np.abs(mix) > lim * 0.8
        if over.any(): k = lim * 0.8; mix = np.where(np.abs(mix) > k, np.sign(mix) * (k + (lim - k) * np.tanh((np.abs(mix) - k) / (lim - k))), mix)
        wavfile.write(out, SR, (np.clip(mix, -1, 1) * 32767).astype(np.int16))
        return lufs(v), lufs(self.music * duck[:, None]) if np.abs(self.music).max() > 0 else -70, lufs(mix)
