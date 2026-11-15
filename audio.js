const loopRate = 22050;
const beatSeconds = .55;
const melody = [
  [[76, .5], [79, .5], [81, 1], [79, .5], [76, .5], [74, 1]],
  [[72, 1], [76, .5], [79, .5], [77, 1], [76, 1]],
  [[74, .5], [77, .5], [81, 1], [84, 1], [81, 1]],
  [[79, 1], [76, 1], [74, 1], [72, 1]],
  [[76, .5], [79, .5], [84, 1], [83, .5], [84, .5], [86, 1]],
  [[84, 1], [81, 1], [79, .5], [81, .5], [76, 1]],
  [[77, .5], [76, .5], [74, 1], [77, .5], [79, .5], [83, 1]],
  [[84, 1], [79, 1], [76, 1], [72, 1]]
];
const chords = [[48, 55, 64], [48, 55, 65], [50, 57, 65], [43, 55, 62],
  [48, 55, 64], [45, 57, 64], [43, 55, 65], [48, 55, 64]];
const pitch = midi => 440 * 2 ** ((midi - 69) / 12);
const tau = 2 * Math.PI;

function winterStreet(context) {
  const buffer = context.createBuffer(1, loopRate * 12, loopRate);
  const samples = buffer.getChannelData(0);
  let lowWind = 0;
  let highWind = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const time = i / loopRate;
    const noise = 2 * Math.random() - 1;
    lowWind += (noise - lowWind) * .024;
    highWind += (noise - highWind) * .19;
    const gust = .69 + .19 * Math.cos(tau * time / 12) + .09 * Math.sin(tau * time / 4);
    const drone = .010 * Math.sin(tau * 60 * time) + .005 * Math.sin(tau * 90 * time);
    const wetRoad = .60 + .40 * Math.sin(tau * time / 6);
    samples[i] = gust * (.45 * lowWind + .08 * highWind) + drone * wetRoad;
  }
  // Sparse neon clicks sit behind the wind and never compete with the music.
  for (const [time, frequency] of [[1.1, 517], [1.25, 407], [4.9, 284], [7.8, 494], [9.8, 364]]) {
    const start = Math.round(time * loopRate);
    for (let i = 0; i < .18 * loopRate; i += 1) {
      const elapsed = i / loopRate;
      const envelope = Math.min(elapsed / .012, 1) * Math.exp(-elapsed * 23);
      samples[start + i] += Math.sin(tau * frequency * elapsed) * envelope * .022;
    }
  }
  const seam = Math.round(loopRate * .045);
  for (let i = 0; i < seam; i += 1) {
    const gain = i / seam;
    samples[i] *= gain;
    samples[samples.length - 1 - i] *= gain;
  }
  return buffer;
}

function holidayTune(context) {
  const buffer = context.createBuffer(1, Math.round(loopRate * melody.length * 4 * beatSeconds), loopRate);
  const samples = buffer.getChannelData(0);

  function writeNote(midi, startBeat, lengthBeats, volume, bell = false) {
    const start = Math.round(startBeat * beatSeconds * loopRate);
    const count = Math.min(samples.length - start, Math.ceil(lengthBeats * beatSeconds * loopRate));
    const frequency = pitch(midi);
    for (let i = 0; i < count; i += 1) {
      const time = i / loopRate;
      const release = Math.min(1, (count - i) / (loopRate * .035));
      const envelope = Math.min(1, time / .007) * release * Math.exp(-time * (bell ? 4.3 : 2.7));
      const phase = tau * frequency * time;
      const tone = bell
        ? .62 * Math.sin(phase) + .29 * Math.sin(phase * 2) + .09 * Math.sin(phase * 3)
        : .84 * Math.sin(phase) + .16 * Math.sin(phase * 3);
      samples[start + i] += volume * tone * envelope;
    }
  }

  for (const [bar, notes] of melody.entries()) {
    let position = bar * 4;
    for (const [midi, length] of notes) {
      writeNote(midi, position, length, .145, true);
      position += length;
    }
    for (const [index, midi] of [...chords[bar], chords[bar][1]].entries()) {
      writeNote(midi, bar * 4 + index, .92, index === 0 ? .078 : .048);
    }
  }
  return buffer;
}

export function createCabinAudio() {
  let context;
  let master;
  let street;
  let music;
  let streetBuffer;
  let musicBuffer;

  async function unlock() {
    if (!context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Audio is unavailable.');
      context = new Audio();
      master = context.createGain();
      master.gain.value = .58;
      master.connect(context.destination);
    }
    if (context.state !== 'running') await context.resume();
  }

  function startLoop(buffer, volume) {
    const gain = context.createGain();
    gain.gain.value = volume;
    gain.connect(master);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
    source.start();
    return { source, gain };
  }

  function stopLoop(loop) {
    if (!loop) return null;
    const now = context.currentTime;
    loop.gain.gain.setTargetAtTime(0, now, .012);
    loop.source.stop(now + .065);
    return null;
  }

  function setRoom(on) {
    if (on && !street) {
      streetBuffer ??= winterStreet(context);
      street = startLoop(streetBuffer, .72);
    }
    if (!on) {
      street = stopLoop(street);
      music = stopLoop(music);
    }
  }

  function setMusic(on) {
    if (on && !music) {
      musicBuffer ??= holidayTune(context);
      music = startLoop(musicBuffer, .76);
    }
    if (!on) music = stopLoop(music);
  }

  function tone({ delay = 0, from, to, duration, volume, type = 'triangle', nasal = false }) {
    const time = context.currentTime + delay;
    const wave = context.createOscillator();
    const gain = context.createGain();
    wave.type = type;
    wave.frequency.setValueAtTime(from, time);
    wave.frequency.exponentialRampToValueAtTime(to, time + duration);
    gain.gain.setValueAtTime(.001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + .012);
    gain.gain.exponentialRampToValueAtTime(.001, time + duration);
    if (nasal) {
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 725;
      filter.Q.value = 2.1;
      wave.connect(filter);
      filter.connect(gain);
    } else {
      wave.connect(gain);
    }
    gain.connect(master);
    wave.onended = () => {
      wave.disconnect();
      gain.disconnect();
    };
    wave.start(time);
    wave.stop(time + duration + .015);
  }

  function click() {
    if (context?.state !== 'running') return;
    tone({ from: 770, to: 447, duration: .048, volume: .052, type: 'square' });
  }

  function pig() {
    if (context?.state !== 'running') return;
    tone({ from: 330, to: 112, duration: .15, volume: .18, type: 'sawtooth', nasal: true });
    tone({ delay: .18, from: 390, to: 112, duration: .16, volume: .18, type: 'sawtooth', nasal: true });
  }

  return { unlock, setRoom, setMusic, click, pig };
}
