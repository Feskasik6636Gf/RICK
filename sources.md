# Источники

- Озвучка: файл пользователя (ElevenLabs), `public/audio/dance_voice.mp3` (98 с, «Танцевальная чума 1518 года»).
- Шрифт субтитров: Montserrat (вариативный, Google Fonts, OFL) — `public/fonts/Montserrat.ttf`. Для тегов-вставок также Nunito и Titan One (OFL).
- Музыка: Mixkit «Spirit in the Woods 2» (id 147), https://mixkit.co/free-stock-music/ambient/ — лицензия Mixkit (бесплатно, без атрибуции).
- Звуки (живые записи, Mixkit Sound Effects, лицензия Mixkit):
  - 368 People in fair ambience and laughter; 377 Shopping center crowd; 364 Big crowd talking loop; 458 Angry male crowd ambience; 469 People moaning sadly;
  - 1269 Walking on stones loop; 1270 Footsteps on stones loop; 542 Footsteps on heels on the pavement; 461 Big army crowd marching; 1222 Walking through dry forest leaves;
  - 195 Creaky door open; 190 Scary wooden door opening; 337 Wooden floorboard creak; 2182 Wood hard hit; 187 Old medieval door lock;
  - 562 Hand tribal drum; 567 Tribal ritual drums; 487 Cinematic ancient drums heartbeat;
  - 587 Clock tower or cathedral bell; 603 Church bell calling; 621 Church bell loop; 623 Low church bell calling.
  - Файлы скачаны скриптом/командой curl с assets.mixkit.co в `audio_src/`; сведение — `scripts/mix_dance.py` (голос −16 LUFS, музыка около −33 под голосом с дакингом 8 дБ, итог −15 LUFS).
- Картинка: three.js + Remotion, всё кодом (мир Страсбурга 1518, человечки, камера, толпа-инстансинг): `src/dance/`. Blender в контейнере недоступен, поэтому вместо Blender-конвейера использован конвейер three.js.
