#!/usr/bin/env python3
"""
Generates Claude Pets' voices into ../sounds/*.wav: each animal's everyday
voice and a grumpy one. They are the only sounds the mod plays.

    pip install numpy scipy        # dev-time only; the WAVs are committed
    python tools/make_sounds.py

A voice is synthesised the way a throat makes one (source and filter): a pitch
contour drives a stack of soft sine harmonics, and moving formants (the mouth's
resonances) shape them into vowels. A meow is a pitch that rises then falls
while the vowel slides m → ee → ah → oo; a growl is the same with a slow
roughness on it. No square waves and no raw noise, so nothing buzzes or hisses:
everything is band-limited, faded in and out, and mastered quietly to one
loudness so no animal is louder than another.
"""
import os
import wave

import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sounds')
TARGET_RMS = 0.045   # every voice ends at this loudness (about -27 dBFS)
PEAK_CAP = 0.25      # and never above this peak


def curve(points, t):
    """A piecewise-linear contour over time: [(seconds, value), ...]."""
    xs, ys = zip(*points)
    return np.interp(t, xs, ys)


def envelope(points, t):
    """An amplitude contour, smoothed so no edge clicks."""
    e = curve(points, t)
    k = max(1, int(SR * 0.008))
    return np.convolve(e, np.ones(k) / k, mode='same')


def edges(x, rise=0.004, fall=0.012):
    """Raised-cosine fade in and out: a short sound with hard edges clicks."""
    a, b = int(SR * rise), int(SR * fall)
    x = x.copy()
    x[:a] *= 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, a))
    x[-b:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, b))
    return x


def voice(dur, f0, formants, amp, harmonics=40, tilt=1.3, vibrato=(5.5, 0.012),
          rough=(0.0, 30.0), breath=0.0, lowpass=4500):
    """
    f0: pitch contour; formants: [(freq contour, bandwidth Hz, weight)];
    amp: amplitude contour; tilt: how fast upper harmonics fade;
    rough: (depth, rate Hz) of a growl's amplitude flutter; breath: a little
    band-limited air shaped by the same formants.
    """
    t = np.arange(int(SR * dur)) / SR
    pitch = curve(f0, t) * (1 + vibrato[1] * np.sin(2 * np.pi * vibrato[0] * t))
    phase = 2 * np.pi * np.cumsum(pitch) / SR
    fcurves = [(curve(fp, t), bw, w) for fp, bw, w in formants]
    out = np.zeros_like(t)
    for k in range(1, harmonics + 1):
        hz = k * pitch
        gain = np.zeros_like(t)
        for fc, bw, w in fcurves:
            gain += w / (1 + ((hz - fc) / bw) ** 2)
        gain *= k ** -tilt * (hz < SR / 2 - 1000)
        out += gain * np.sin(k * phase)
    if breath:
        noise = np.random.default_rng(7).standard_normal(len(t))
        for fc, bw, w in fcurves[:2]:
            centre = float(np.mean(fc))
            sos = butter(2, [max(80, centre - bw), min(SR / 2 - 100, centre + bw)], 'bandpass', fs=SR, output='sos')
            out += breath * w * sosfilt(sos, noise) * 0.5
    depth, rate = rough
    if depth:
        out *= 1 - depth * (0.5 + 0.5 * np.sin(2 * np.pi * rate * t))
    out *= envelope(amp, t)
    sos = butter(4, lowpass, 'lowpass', fs=SR, output='sos')
    return edges(sosfilt(sos, out), rise=min(0.006, dur / 8), fall=min(0.012, dur / 6))


def ping(freq, dur=0.06, decay=90):
    """A soft, damped tick: what a claw tap or a dolphin click is made of."""
    t = np.arange(int(SR * dur)) / SR
    return edges(np.sin(2 * np.pi * freq * t) * np.exp(-decay * t))


def thump(f_from, f_to, dur=0.22):
    t = np.arange(int(SR * dur)) / SR
    f = np.linspace(f_from, f_to, len(t))
    return edges(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-16 * t), rise=0.006, fall=0.05)


def joined(a, b, overlap=0.06):
    """Crossfades b onto the end of a, so the seam never clicks."""
    n = int(SR * overlap)
    ramp = np.linspace(0, 1, n)
    mid = a[-n:] * (1 - ramp) + b[:n] * ramp
    return np.concatenate([a[:-n], mid, b[n:]])


def gap(sec):
    return np.zeros(int(SR * sec))


def seq(*parts):
    return np.concatenate(parts)


def write(name, x):
    x = x - np.mean(x)
    rms = np.sqrt(np.mean(x ** 2)) or 1.0
    x = x * (TARGET_RMS / rms)
    peak = np.max(np.abs(x)) or 1.0
    if peak > PEAK_CAP:
        x = x * (PEAK_CAP / peak)
    fade = int(SR * 0.01)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    os.makedirs(OUT, exist_ok=True)
    with wave.open(os.path.join(OUT, f'{name}.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())


# ── cat ──────────────────────────────────────────────────────────────────────
# "mee-ow": pitch up then down; F1/F2 slide from a closed m, through ee, to ah, to oo.
write('meow', voice(
    0.78,
    f0=[(0, 460), (0.16, 720), (0.38, 690), (0.78, 400)],
    formants=[
        ([(0, 280), (0.14, 340), (0.36, 820), (0.6, 640), (0.78, 380)], 120, 1.0),
        ([(0, 1100), (0.14, 2300), (0.36, 1500), (0.6, 1050), (0.78, 820)], 220, 0.55),
        ([(0, 2900), (0.78, 2800)], 300, 0.15),
    ],
    amp=[(0, 0), (0.06, 0.7), (0.2, 1.0), (0.55, 0.8), (0.78, 0)],
    breath=0.04,
))
# grumpy: a low, rolling "mrrrr" that opens into a sulky, falling "rowl"
write('meow_grumpy', joined(
    voice(0.6, f0=[(0, 210), (0.55, 235)],
          formants=[([(0, 330), (0.55, 420)], 110, 1.0), ([(0, 900), (0.55, 1000)], 200, 0.4)],
          amp=[(0, 0), (0.08, 0.8), (0.5, 0.9), (0.6, 0.75)], rough=(0.45, 24), tilt=1.6),
    voice(0.5, f0=[(0, 330), (0.12, 380), (0.5, 250)],
          formants=[([(0, 450), (0.2, 750), (0.5, 400)], 120, 1.0), ([(0, 1100), (0.2, 1300), (0.5, 800)], 220, 0.45)],
          amp=[(0, 0.75), (0.15, 1.0), (0.5, 0)], rough=(0.2, 24)),
))

# ── dog ──────────────────────────────────────────────────────────────────────
def woof():
    return voice(0.2, f0=[(0, 300), (0.05, 260), (0.2, 170)],
                 formants=[([(0, 650), (0.2, 420)], 150, 1.0), ([(0, 1150), (0.2, 900)], 250, 0.4)],
                 amp=[(0, 0), (0.012, 1.0), (0.08, 0.7), (0.2, 0)], breath=0.12, tilt=1.4)


write('woof', seq(woof(), gap(0.12), woof()))
write('woof_grumpy', voice(1.0, f0=[(0, 120), (1.0, 108)],
                           formants=[([(0, 420), (1.0, 380)], 120, 1.0), ([(0, 950), (1.0, 900)], 200, 0.35)],
                           amp=[(0, 0), (0.15, 0.9), (0.85, 0.8), (1.0, 0)], rough=(0.6, 22), tilt=1.6))

# ── crab ─────────────────────────────────────────────────────────────────────
write('click', seq(ping(1700), gap(0.09), ping(1900), gap(0.09), ping(1600)))
write('click_grumpy', seq(*[seq(ping(1400 + 80 * (i % 3), decay=110), gap(0.05)) for i in range(7)]))

# ── shark: two soft snaps ────────────────────────────────────────────────────
write('chomp', seq(thump(170, 70), gap(0.08), thump(160, 65)))

# ── turtle and giraffe: a low, closed-mouth hum ─────────────────────────────
write('hum', voice(1.0, f0=[(0, 140), (0.4, 152), (1.0, 132)],
                   formants=[([(0, 250), (1.0, 260)], 90, 1.0), ([(0, 900), (1.0, 850)], 200, 0.2)],
                   amp=[(0, 0), (0.25, 0.9), (0.7, 1.0), (1.0, 0)], tilt=1.8, vibrato=(4, 0.01)))

# ── mouse: three tiny squeaks ────────────────────────────────────────────────
def squeak(f):
    return voice(0.07, f0=[(0, f), (0.07, f * 1.2)], formants=[([(0, f), (0.07, f * 1.2)], 600, 1.0)],
                 amp=[(0, 0), (0.015, 1.0), (0.07, 0)], harmonics=3, tilt=2.0, lowpass=8000)


write('squeak', seq(squeak(2600), gap(0.05), squeak(2900), gap(0.05), squeak(2750)))

# ── fox: a bright yip, twice ─────────────────────────────────────────────────
def yip():
    return voice(0.16, f0=[(0, 620), (0.05, 1050), (0.16, 560)],
                 formants=[([(0, 700), (0.16, 600)], 160, 1.0), ([(0, 1800), (0.16, 1500)], 260, 0.5)],
                 amp=[(0, 0), (0.02, 1.0), (0.16, 0)])


write('yip', seq(yip(), gap(0.08), yip()))

# ── orca and whale: a slow, sweeping song ───────────────────────────────────
write('song', voice(1.9, f0=[(0, 200), (0.5, 420), (1.0, 300), (1.45, 380), (1.9, 240)],
                    formants=[([(0, 420), (1.9, 380)], 260, 1.0)],
                    amp=[(0, 0), (0.35, 0.9), (1.5, 1.0), (1.9, 0)],
                    harmonics=6, tilt=2.2, vibrato=(4.0, 0.02), lowpass=3000))

# ── dolphin: a few soft clicks, then a whistle ──────────────────────────────
whistle = voice(0.55, f0=[(0, 1600), (0.15, 2400), (0.3, 1900), (0.55, 2700)],
                formants=[([(0, 2000), (0.55, 2400)], 1500, 1.0)],
                amp=[(0, 0), (0.06, 1.0), (0.45, 0.9), (0.55, 0)], harmonics=1, vibrato=(7, 0.01), lowpass=8000)
write('whistle', seq(*[seq(ping(3200, 0.03, 180) * 0.35, gap(0.03)) for _ in range(5)], whistle))

# ── tiger: a deep, rounded roar ──────────────────────────────────────────────
write('roar', voice(1.1, f0=[(0, 95), (0.3, 140), (1.1, 85)],
                    formants=[([(0, 500), (0.3, 750), (1.1, 450)], 160, 1.0), ([(0, 1100), (0.3, 1250), (1.1, 950)], 260, 0.45)],
                    amp=[(0, 0), (0.12, 0.8), (0.35, 1.0), (1.1, 0)],
                    rough=(0.3, 30), breath=0.03, tilt=1.6, lowpass=2200))

# ── squirrel: a soft, quick chitter ──────────────────────────────────────────
def chirp(f):
    return voice(0.04, f0=[(0, f), (0.04, f * 1.1)], formants=[([(0, f), (0.04, f)], 800, 1.0)],
                 amp=[(0, 0), (0.008, 1.0), (0.04, 0)], harmonics=2, tilt=2.0, lowpass=8000)


write('chitter', seq(*[seq(chirp(1800 + 160 * (i % 3)), gap(0.025)) for i in range(9)]))

# ── penguin: a nasal, honking bray ──────────────────────────────────────────
def honk(f):
    return voice(0.22, f0=[(0, f), (0.22, f * 0.85)],
                 formants=[([(0, 520), (0.22, 480)], 120, 1.0), ([(0, 1500), (0.22, 1400)], 200, 0.7), ([(0, 2500), (0.22, 2400)], 260, 0.3)],
                 amp=[(0, 0), (0.03, 1.0), (0.22, 0)], rough=(0.15, 28))


write('honk', seq(honk(420), gap(0.06), honk(380), gap(0.06), honk(440)))

# ── shared grumpy voices for the rest of the roster ─────────────────────────
write('grumble_low', voice(0.9, f0=[(0, 125), (0.9, 100)],
                           formants=[([(0, 400), (0.9, 360)], 120, 1.0), ([(0, 900), (0.9, 850)], 200, 0.35)],
                           amp=[(0, 0), (0.15, 0.9), (0.75, 0.8), (0.9, 0)], rough=(0.5, 22), tilt=1.6))


def hmph(f):
    return voice(0.24, f0=[(0, f), (0.24, f * 0.82)],
                 formants=[([(0, 300), (0.24, 320)], 100, 1.0), ([(0, 1200), (0.24, 1100)], 220, 0.3)],
                 amp=[(0, 0), (0.03, 1.0), (0.24, 0)], tilt=1.7)


write('grumble_high', seq(hmph(470), gap(0.07), hmph(420)))

print('wrote', sorted(os.listdir(OUT)))
