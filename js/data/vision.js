// js/data/vision.js
export const VISION_CONFIG = {
  // Угол обзора (в градусах)
  fovAngle: 90, 
  
  // Дистанция обнаружения (замечаем силуэт)
  detectRange: 100, 
  
  // Дистанция идентификации (понимаем, что это враг)
  identifyRange: 50,
  
  // Цвета
  visionColor: 'rgba(255, 255, 255, 0.05)',
  fogOfWarColor: '#0a0c10'
};

export const AUDIO_CONFIG = {
  // Громкость шагов в зависимости от позы (0 - тихо, 1 - громко)
  stepNoise: {
    prone: 0.1,
    crouch: 0.3,
    stand: 0.6,
    run: 1.0
  },
  
  // Множитель шума от веса (тяжелый юнит топает громче)
  weightNoiseMultiplier: 0.02, // 1 кг = +2% шума

  // Громкость выстрела
  gunshotNoise: 10.0, 

  // Радиус слышимости (насколько далеко слышен шум)
  hearingRange: 200 
};
