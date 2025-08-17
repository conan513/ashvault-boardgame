// server/characters.js
// 12 karakter (3-3-3-3), fix spawn az outer negyedekben.

exports.characters = [
  { id:"sm_titus",   name:"Captain Titus",           faction:"Space Marines", HP:25, ATK:6, DEF:4, PSY:1, RES:3, spawn:0 },
  { id:"sm_asteros", name:"Librarian Asteros",       faction:"Space Marines", HP:22, ATK:5, DEF:3, PSY:5, RES:3, spawn:2 },
  { id:"sm_ferrus",  name:"Techmarine Ferrus",       faction:"Space Marines", HP:24, ATK:5, DEF:5, PSY:0, RES:4, spawn:4 },

  { id:"el_eldrad",  name:"Farseer Eldrad Ulthran",  faction:"Eldar",         HP:20, ATK:4, DEF:3, PSY:7, RES:4, spawn:5 },
  { id:"el_jainzar", name:"Jain Zar",                faction:"Eldar",         HP:22, ATK:6, DEF:3, PSY:2, RES:3, spawn:7 },
  { id:"el_illic",   name:"Illic Nightspear",        faction:"Eldar",         HP:21, ATK:5, DEF:2, PSY:1, RES:5, spawn:9 },

  { id:"ok_ghazghkull", name:"Ghazghkull Mag Uruk Thraka", faction:"Orks",   HP:28, ATK:7, DEF:3, PSY:0, RES:2, spawn:10 },
  { id:"ok_zogwort",    name:"Weirdboy Zogwort",           faction:"Orks",   HP:23, ATK:5, DEF:2, PSY:4, RES:2, spawn:12 },
  { id:"ok_grimskull",  name:"Nob Grimskull",              faction:"Orks",   HP:24, ATK:6, DEF:3, PSY:0, RES:3, spawn:14 },

  { id:"ch_abaddon", name:"Abaddon the Despoiler",  faction:"Chaos",         HP:27, ATK:7, DEF:4, PSY:2, RES:3, spawn:15 },
  { id:"ch_ahriman", name:"Ahriman",               faction:"Chaos",         HP:22, ATK:5, DEF:3, PSY:6, RES:3, spawn:17 },
  { id:"ch_typhus",  name:"Typhus",                faction:"Chaos",         HP:26, ATK:6, DEF:4, PSY:3, RES:2, spawn:19 }
];
