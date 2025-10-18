import io
import math
import struct
import wave

def siren_wav_bytes() -> bytes:
    """Generate a short siren-like WAV (mono, 44.1kHz, 16-bit) always the same.
    Sweep from 650Hz to ~950Hz over ~0.7s with slight amplitude envelope.
    """
    sample_rate = 44100
    duration = 0.7  # seconds
    n_samples = int(sample_rate * duration)
    start_freq = 650.0
    end_freq = 950.0

    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        for i in range(n_samples):
            t = i / sample_rate
            # linear frequency sweep
            f = start_freq + (end_freq - start_freq) * (i / max(1, n_samples - 1))
            # simple attack/decay envelope
            attack = min(1.0, i / (0.05 * sample_rate))
            release = min(1.0, (n_samples - i) / (0.08 * sample_rate))
            env = max(0.0, min(1.0, attack * release))
            val = int(32767 * 0.5 * env * math.sin(2 * math.pi * f * t))
            wf.writeframesraw(struct.pack('<h', val))
    return buf.getvalue()
