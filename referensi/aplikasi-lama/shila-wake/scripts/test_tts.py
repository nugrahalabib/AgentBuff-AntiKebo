#!/usr/bin/env python3
"""Quick TTS test script"""
from pathlib import Path
import os, wave, tempfile, subprocess

# Load API key
env_file = Path.home() / '.openclaw' / '.env'
api_key = None
if env_file.exists():
    for line in open(env_file):
        if line.startswith('GEMINI_API_KEY='):
            api_key = line.split('=', 1)[1].strip()
            break

if not api_key:
    print("ERROR: No API key found")
    exit(1)

print(f"API Key: {api_key[:20]}...")

from google import genai
from google.genai import types

client = genai.Client(api_key=api_key)

print('Generating TTS...')
response = client.models.generate_content(
    model='gemini-2.5-flash-preview-tts',
    contents='Selamat pagi, ini adalah test suara Gemini.',
    config=types.GenerateContentConfig(
        response_modalities=['AUDIO'],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name='Kore',
                )
            )
        ),
    )
)

# Get audio data - already bytes
audio_data = response.candidates[0].content.parts[0].inline_data.data
print(f'Got {len(audio_data)} bytes of audio')

# Save to temp WAV
with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
    tmp_path = tmp.name
    with wave.open(tmp.name, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(24000)
        wf.writeframes(audio_data)

print(f'Saved to {tmp_path}')
print('Playing...')

# Play using Windows
subprocess.run(
    ['powershell', '-Command', f'(New-Object Media.SoundPlayer "{tmp_path}").PlaySync()'],
    capture_output=True,
    timeout=60
)

print('Done!')
os.unlink(tmp_path)
