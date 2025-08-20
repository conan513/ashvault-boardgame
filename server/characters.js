// server/characters.js
// 12 karakter (3-3-3-3), fix spawn az outer negyedekben.

exports.characters = [
  // Space Marines
  {
    id: "sm_titus",
    name: "Captain Titus",
    faction: "Space Marines",
    HP: 3, ATK: 4, DEF: 2, PSY: 0, RES: 1,
    spawn: 0,
    img: "./assets/chars/sm_titus.png"
  },
{
  id: "sm_asteros",
  name: "Librarian Asteros",
  faction: "Space Marines",
  HP: 2, ATK: 1, DEF: 1, PSY: 5, RES: 1,
  spawn: 2,
  img: "./assets/chars/sm_asteros.png"
},
{
  id: "sm_ferrus",
  name: "Techmarine Ferrus",
  faction: "Space Marines",
  HP: 4, ATK: 2, DEF: 3, PSY: 0, RES: 1,
  spawn: 4,
  img: "./assets/chars/sm_ferrus.png"
},

// Eldar
{
  id: "el_eldrad",
  name: "Farseer Eldrad Ulthran",
  faction: "Eldar",
  HP: 1, ATK: 1, DEF: 1, PSY: 6, RES: 1,
  spawn: 5,
  img: "./assets/chars/el_eldrad.png"
},
{
  id: "el_jainzar",
  name: "Jain Zar",
  faction: "Eldar",
  HP: 3, ATK: 5, DEF: 1, PSY: 0, RES: 1,
  spawn: 7,
  img: "./assets/chars/el_jainzar.png"
},
{
  id: "el_illic",
  name: "Illic Nightspear",
  faction: "Eldar",
  HP: 2, ATK: 4, DEF: 2, PSY: 1, RES: 1,
  spawn: 9,
  img: "./assets/chars/el_illic.png"
},

// Orks
{
  id: "ok_ghazghkull",
  name: "Ghazghkull Mag Uruk Thraka",
  faction: "Orks",
  HP: 6, ATK: 3, DEF: 1, PSY: 0, RES: 0,
  spawn: 10,
  img: "./assets/chars/ok_ghazghkull.png"
},
{
  id: "ok_zogwort",
  name: "Weirdboy Zogwort",
  faction: "Orks",
  HP: 3, ATK: 2, DEF: 1, PSY: 3, RES: 1,
  spawn: 12,
  img: "./assets/chars/ok_zogwort.png"
},
{
  id: "ok_grimskull",
  name: "Nob Grimskull",
  faction: "Orks",
  HP: 5, ATK: 2, DEF: 2, PSY: 0, RES: 1,
  spawn: 14,
  img: "./assets/chars/ok_grimskull.png"
},

// Chaos
{
  id: "ch_abaddon",
  name: "Abaddon the Despoiler",
  faction: "Chaos",
  HP: 5, ATK: 3, DEF: 1, PSY: 1, RES: 0,
  spawn: 15,
  img: "./assets/chars/ch_abaddon.png"
},
{
  id: "ch_ahriman",
  name: "Ahriman",
  faction: "Chaos",
  HP: 2, ATK: 1, DEF: 1, PSY: 5, RES: 1,
  spawn: 17,
  img: "./assets/chars/ch_ahriman.png"
},
{
  id: "ch_typhus",
  name: "Typhus",
  faction: "Chaos",
  HP: 4, ATK: 2, DEF: 2, PSY: 1, RES: 1,
  spawn: 19,
  img: "./assets/chars/ch_typhus.png"
}
];
