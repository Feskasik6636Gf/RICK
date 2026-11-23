#!/usr/bin/env python3
"""Mix: voice (-16 LUFS) + procedural wind / drone / SFX. All sounds are synthesised here (no samples needed). Output public/audio/mix.wav"""
import subprocess, sys, numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile
SR = 48000
rng = np.random.default_rng(7)
D = 95.2
N = int(D * SR)
T = np.arange(N) / SR

def ff(args):
    subprocess.run(["ffmpeg", "-y", "-v", "error"] + args, check=True)

ff(["-i", "public/audio/voice.mp3", "-af", "loudnorm=I=-16:TP=-1.5:LRA=7", "-ar", str(SR), "-ac", "1", "/tmp/voice_n.wav"])
vr, v = wavfile.read("/tmp/voice_n.wav"); v = v.astype(np.float32) / (32768 if v.dtype == np.int16 else 1)
voice = np.zeros(N, np.float32); voice[: min(N, len(v))] = v[:N]

def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], "band", fs=SR, output="sos"), x)
def noise(n): return rng.standard_normal(n).astype(np.float32)
def env(t0, a, d, n=None):  # attack/decay envelope array over whole timeline
    e = np.zeros(N, np.float32); i0 = int(t0 * SR); L = int((a + d) * SR)
    k = np.arange(L) / SR; w = np.where(k < a, k / max(a, 1e-4), np.exp(-(k - a) / (d / 4)))
    e[i0:i0 + L] = w[: max(0, min(L, N - i0))]; return e
def put(x, t0, sig, g=1.0):
    i = int(t0 * SR); n = min(len(sig), N - i)
    if n > 0 and i >= 0: x[i:i + n] += sig[:n] * g
def smoothstep(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
def ramp(t, a, b): return smoothstep((t - a) / (b - a))

# ---------- wind: filtered noise, gusts, intensity by scene ----------
w = noise(N)
slow = 0.55 + 0.45 * np.sin(2 * np.pi * T / 6.5 + 1.3) * np.sin(2 * np.pi * T / 3.1)
wind = bp(w, 180, 900) * slow + 0.5 * lp(w, 300)
inten = 0.12 + 0.2 * ramp(T, 6, 12) + 0.5 * ramp(T, 17, 22) * (1 - ramp(T, 29, 29.6) * 0.0) + 0.3 * ramp(T, 29.5, 33) + 0.2 * ramp(T, 46, 52)
inten *= 1 - 0.55 * ramp(T, 61, 62) * (1 - ramp(T, 68, 69)) - 0.5 * ramp(T, 83.8, 85) * (1 - ramp(T, 88, 89))
inten *= 1 - 0.4 * ramp(T, 15.6, 16.0) * (1 - ramp(T, 29.4, 29.5))  # muffled inside the tent
wind = (wind * inten).astype(np.float32)

# ---------- drone music: Am pad, slow swells, minor second tension ----------
def pad(f, amp, detune=0.004):
    s = np.zeros(N, np.float32)
    for dt in (-detune, 0, detune):
        ph = 2 * np.pi * np.cumsum(np.full(N, f * (1 + dt))) / SR
        s += (np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.18 * np.sin(3 * ph)).astype(np.float32)
    return s * amp / 3
mus = pad(55.0, 1.0) + pad(82.4, 0.55) + pad(110.0, 0.5) + pad(130.8, 0.3)
tens = pad(58.3, 0.35) * ramp(T, 15.8, 30) * (1 - ramp(T, 60, 61)) + pad(116.5, 0.2) * ramp(T, 68, 74)  # semitone clash on the scary parts
mus = lp(mus + tens, 700)
mus *= (0.45 + 0.3 * ramp(T, 9.7, 16) + 0.35 * ramp(T, 29, 40) + 0.15 * ramp(T, 53, 61) + 0.35 * ramp(T, 68, 78)) * (1 - 0.35 * ramp(T, 83, 85))
mus *= (0.85 + 0.15 * np.sin(2 * np.pi * T / 4.0))
# gentle bell-like plucks on the A minor arp (sparse), start of the film and the question section
bells = np.zeros(N, np.float32)
for i, t0 in enumerate(list(np.arange(0.4, 9.5, 1.7)) + list(np.arange(68.4, 77.5, 1.2)) + list(np.arange(88.5, 94, 1.9))):
    f = [220, 261.6, 329.6, 261.6, 196][i % 5]; tt = np.arange(int(2.2 * SR)) / SR
    put(bells, t0, (np.sin(2 * np.pi * f * tt) * np.exp(-tt * 2.2) * 0.5 + np.sin(2 * np.pi * f * 2.0 * tt) * np.exp(-tt * 4) * 0.2).astype(np.float32), 0.12)
mus = mus + bells

# ---------- SFX ----------
sfx = np.zeros(N, np.float32)
def whoosh(t0, dur=0.45, g=0.5, f0=300, f1=3500):
    n = int(dur * SR); x = noise(n); k = np.arange(n) / n
    fc = f0 * (f1 / f0) ** k; out = np.zeros(n, np.float32)
    blocks = 24
    for b in range(blocks):
        a, e = int(b * n / blocks), int((b + 1) * n / blocks)
        out[a:e] = bp(x[a:e] if e - a > 200 else x[a:e], max(60, fc[a] * 0.6), min(SR / 2 - 100, fc[a] * 1.4), 1)
    out *= np.sin(np.pi * k) ** 1.5; put(sfx, t0, out, g)
def boom(t0, g=0.9, f=48, d=1.4):
    tt = np.arange(int(d * SR)) / SR; s = np.sin(2 * np.pi * (f + 60 * np.exp(-tt * 14)) * tt) * np.exp(-tt * 3.2); s += 0.35 * lp(noise(len(tt)), 400) * np.exp(-tt * 6); put(sfx, t0, s.astype(np.float32), g)
def thump(t0, g=0.7):  # heartbeat lub-dub
    for dt, gg in ((0, 1.0), (0.22, 0.7)):
        tt = np.arange(int(0.25 * SR)) / SR; put(sfx, t0 + dt, (np.sin(2 * np.pi * 52 * tt) * np.exp(-tt * 18)).astype(np.float32), g * gg)
def crunch(t0, g=0.35):
    n = int(0.09 * SR); x = hp(noise(n), 1200) * np.exp(-np.arange(n) / (0.025 * SR)); x += 0.6 * bp(noise(n), 300, 1500) * np.exp(-np.arange(n) / (0.04 * SR)); put(sfx, t0, x.astype(np.float32), g)
def rip(t0, dur=0.9, g=0.8):
    n = int(dur * SR); x = hp(noise(n), 1800); k = np.arange(n) / n
    e = (np.abs(np.sin(k * 60 + np.sin(k * 23) * 3)) ** 3) * (1 - k * 0.5) * np.minimum(1, k * 30); put(sfx, t0, (x * e).astype(np.float32), g)

CUTS = [6.9, 9.7, 15.8, 29.5, 33.8, 39.0, 46.4, 53.0, 61.0, 68.4, 73.8, 77.8, 83.8, 88.3]
for c in CUTS: whoosh(c - 0.25, 0.4, 0.35)
whoosh(0.0, 1.2, 0.18, 200, 1800); whoosh(3.0, 1.4, 0.25, 250, 2500)             # opening pull-out
whoosh(26.5, 0.5, 0.35, 150, 2200); boom(26.6, 0.55, 55, 1.0)                    # "что-то не так"
rip(29.35, 1.0, 0.9); boom(29.5, 0.9); whoosh(30.7, 0.5, 0.4)                    # tent cut + burst out
for i in range(10): crunch(34.0 + i * 0.28 + rng.random() * 0.05, 0.3)           # running out
boom(39.0, 0.95, 42, 2.0)                                                          # -25
for i in range(26): crunch(40.0 + i * 0.52 + rng.random() * 0.1, 0.22)           # barefoot steps
for t0 in np.arange(46.4, 53.0, 0.95): thump(t0, 0.55)                           # heartbeat
whoosh(49.5, 0.55, 0.5, 200, 3000)                                                 # turn back to the tent
boom(61.0, 0.6, 50, 1.6)
for t0 in np.arange(54.0, 56.4, 0.0 + 0.037): pass
fire = hp(noise(N), 800) * (rng.random(N) > 0.9996) * 1.0
fire = lp(fire, 5000); fire *= ((T > 53) & (T < 57)) * (1 - ramp(T, 56, 57)); sfx += fire.astype(np.float32) * 14
for t0 in np.arange(61.5, 68.4, 0.9): thump(t0, 0.35 * ramp(np.array([t0]), 61, 65)[0])
boom(68.4, 0.7, 60, 1.4)
for t0 in np.arange(69.4, 73.6, 0.75 - 0.0): thump(t0, 0.5)
whoosh(73.9, 1.6, 0.5, 120, 1500); boom(75.7, 0.6, 38, 2.0)
boom(77.8, 1.0, 40, 2.5)
aval = lp(noise(N), 160, 3) * 3.5 + lp(noise(N), 900) * 0.8
aval *= ramp(T, 78.3, 81.0) * (1 - ramp(T, 83.0, 84.5)) * (0.7 + 0.3 * np.sin(T * 17)); sfx += aval.astype(np.float32) * 0.9
whoosh(83.8, 1.2, 0.3, 200, 2000)
for t0 in (93.4,): boom(t0, 0.4, 36, 2.5)

# ---------- balance ----------
def rms(x): return float(np.sqrt(np.mean(x ** 2)) + 1e-9)
vr_ = rms(voice[voice != 0])
mus *= (vr_ * 0.0525) / rms(mus)           # ~ -25 dB under the voice
wind *= (vr_ * 0.07) / rms(wind) * 1.0     # ~ -23 dB under the voice; scene intensity rides on top
sfx *= vr_ * 0.9
# duck music+wind 6 dB under the voice
vo_env = lp(np.abs(voice), 6, 1); vo_env = np.clip(vo_env / (vo_env.max() + 1e-9) * 6, 0, 1)
duck = 1 - 0.5 * vo_env
mix = voice + (mus + wind) * duck + sfx
# fade in/out
mix *= np.clip(T / 0.05, 0, 1) * np.clip((D - T) / 1.3, 0, 1)
mix = np.tanh(mix * 0.9) / np.tanh(0.9)
wavfile.write("/tmp/mix_raw.wav", SR, (mix * 32767 * 0.9).astype(np.int16))
ff(["-i", "/tmp/mix_raw.wav", "-af", "loudnorm=I=-15:TP=-1.5:LRA=9", "-ar", str(SR), "-ac", "2", "public/audio/mix.wav"])
print("mix ok")
