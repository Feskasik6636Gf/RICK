#!/usr/bin/env python3
"""Dance plague film: voice (-16 LUFS) + Mixkit music/foley (all real recordings, see sources.md) -> public/audio/dance_mix.wav"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from mixlib import Mix
A = "audio_src/"
DUR = 98.0
m = Mix(DUR)
X = lambda id: f"{A}x_{id}.mp3"
# --- music: calm, quiet, under the voice the whole time ---
m.add(A + "m_147.mp3", 0.0, target=-33, dur=DUR, loop=True, bus="music", fin=1.2, fout=2.0)
# --- 0-9 Strasbourg morning: fair ambience + steps on stones ---
m.add(X(368), 0.0, target=-40, dur=9.0, fin=0.3, fout=0.8, loop=True)
m.add(X(1269), 0.2, target=-42, dur=2.8, fout=0.6)
# --- 9-15 street, one woman ---
m.add(X(1270), 9.0, target=-44, dur=4.0, fout=0.5)
# --- 14-31 she dances: steady stamping on the pavement, music dips (she hears none) ---
m.add(X(542), 14.0, target=-38, dur=17.0, loop=True, rate=1.5, fin=0.3, fout=1.0)
# --- 24: bell tolls, days pass ---
m.add(X(587), 23.9, target=-35, dur=6.0, fout=1.5)
# --- 29: others join, feet gather ---
m.add(X(461), 28.9, target=-38, dur=4.5, rate=1.25, fout=0.8, fin=0.5)
# --- 31-38 market gets crowded ---
m.add(X(377), 31.0, target=-37, dur=7.0, fin=0.4, fout=0.5)
m.add(X(364), 33.0, target=-38, dur=5.0, fin=1.0, fout=0.5)
# --- 38 door creaks, hundreds in the square ---
m.add(X(195), 37.7, target=-33)
m.add(X(364), 38.0, target=-33, dur=6.0, fin=0.6, fout=0.5)
# --- 44-50 people fall, moaning ---
m.add(X(469), 44.3, target=-36, dur=5.7, fin=0.6, fout=0.8)
m.add(X(1269), 44.0, target=-41, dur=6.0, rate=1.9, fout=0.5)
# --- 50-55 council hall ---
m.add(X(337), 50.2, target=-38)
m.add(X(458), 50.0, target=-41, dur=5.0, fin=0.4, fout=0.5)
m.add(X(190), 52.5, target=-36)
# --- 55-59 doctors cheer them on ---
m.add(X(364), 54.9, target=-35, dur=4.0, fin=0.3, fout=0.5)
# --- 59-63 stage built: hammering, then musicians' drum ---
for t in (59.95, 60.5, 61.05, 61.6, 62.0): m.add(X(2182), t, target=-37)
m.add(X(567), 62.5, target=-36, dur=4.5, fin=0.2, fout=1.0)
for k, t in enumerate((62.5, 62.97, 63.43, 63.9, 64.37)): m.add(X(562), t, target=-38)
# --- 63.6-67 fear ---
m.add(X(469), 63.8, target=-43, dur=3.4, fin=0.5, fout=0.6)
# --- 67.6 notice nailed up ---
for t in (67.62, 67.9, 68.18): m.add(X(2182), t, target=-31)
# --- 69.5-76 procession and shrine ---
m.add(X(461), 69.8, target=-37, dur=6.2, rate=0.9, fin=0.5, fout=0.8)
m.add(X(603), 71.4, target=-34, dur=5.0, fin=0.05, fout=1.6)
# --- 76 September: leaves, quiet ---
m.add(X(1222), 76.3, target=-40, dur=6.0, fin=0.8, fout=0.8)
m.add(X(623), 79.8, target=-36, dur=3.0, fout=1.2)
# --- 82.5-87.8 puppets: slow ancient heartbeat ---
m.add(X(487), 82.4, target=-36, dur=5.5, fin=0.5, fout=0.8)
# --- 87.8-94 hunger: door lock, low heartbeat ---
m.add(X(487), 87.8, target=-40, dur=5.0, start=8.0, fin=0.8, fout=0.8)
m.add(X(187), 91.1, target=-33, dur=3.2, fout=0.6)
# --- 94.3 the callback: a bell over the empty square ---
m.add(X(621), 94.4, target=-36, dur=3.4, fout=1.6)
print(m.render("public/audio/dance_voice.mp3", "public/audio/dance_mix.wav", vo_target=-16.0, duck_db=8.0, end_fade=0.6))
