export const VISION_CONFIG = {
  fovAngle: 120,
  centralAngle: 60,
  detectRange: 100,
  identifyRange: 50,
  peripheralRange: 30,
};

// FIX: единая шкала громкости
// loudness — «громкость в метрах» при которой слышно на этой дистанции
// слышимость = loudness / (dist^0.5) — упрощённая модель
export const AUDIO_CONFIG = {
  stepLoudness: {
    prone:  20,
    crouch: 60,
    stand: 120,
    run:   200,
  },
  weightLoudnessPerKg: 0.5,
  gunshotLoudnessDefault: 400,
  // базовая формула: слышно если loudness / sqrt(dist) > threshold
  hearingThreshold: 10,
};
