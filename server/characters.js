// server/characters.js
// 12 karakter (3-3-3-3), fix spawn az outer negyedekben.

// Order of Knights
exports.characters = [
  {
    id: "ok_caelis",
    name: "Caelis Bloodsworn",
    faction: "Order of Knights",
    HP: 3, ATK: 5, DEF: 2, PSY: 1, RES: 1,
    spawn: 0,
    img: "./assets/chars/ok_caelis.jpg",
    pawn: "./assets/pawns/ok_caelis.png"
  },
{
  id: "ok_tharion",
  name: "Tharion Granitewatch",
  faction: "Order of Knights",
  HP: 5, ATK: 2, DEF: 5, PSY: 0, RES: 2,
  spawn: 2,
  img: "./assets/chars/ok_tharion.jpg",
  pawn: "./assets/pawns/ok_tharion.png"
},
{
  id: "ok_elenys",
  name: "Elenys Goldvoice",
  faction: "Order of Knights",
  HP: 2, ATK: 1, DEF: 2, PSY: 4, RES: 2,
  spawn: 4,
  img: "./assets/chars/ok_elenys.jpg",
  pawn: "./assets/pawns/ok_elenys.png"
},

// The Hollow Grove
{
  id: "hg_grallok",
  name: "Grallok, the Tree Slayer",
  faction: "The Hollow Grove",
  HP: 4, ATK: 4, DEF: 3, PSY: 0, RES: 1,
  spawn: 6,
  img: "./assets/chars/hg_grallok.jpg",
  pawn: "./assets/pawns/hg_grallok.png"
},
{
  id: "hg_morgra",
  name: "Morgra, the Wildmother",
  faction: "The Hollow Grove",
  HP: 5, ATK: 2, DEF: 4, PSY: 1, RES: 2,
  spawn: 8,
  img: "./assets/chars/hg_morgra.jpg",
  pawn: "./assets/pawns/hg_morgra.png"
},
{
  id: "hg_thistle",
  name: "Thistle, the Thornwisp",
  faction: "The Hollow Grove",
  HP: 2, ATK: 1, DEF: 2, PSY: 5, RES: 1,
  spawn: 10,
  img: "./assets/chars/hg_thistle.jpg",
  pawn: "./assets/pawns/hg_thistle.png"
},

// Cyber Dwarves
{
  id: "cd_blazgrin",
  name: "Engineer Blazgrin Sparkfist",
  faction: "Cyber Dwarves",
  HP: 3, ATK: 5, DEF: 2, PSY: 0, RES: 1,
  spawn: 12,
  img: "./assets/chars/cd_blazgrin.jpg",
  pawn: "./assets/pawns/cd_blazgrin.png"
},
{
  id: "cd_krank",
  name: "Warden Krank Ironstep",
  faction: "Cyber Dwarves",
  HP: 6, ATK: 2, DEF: 5, PSY: 0, RES: 2,
  spawn: 14,
  img: "./assets/chars/cd_krank.jpg",
  pawn: "./assets/pawns/cd_krank.png"
},
{
  id: "cd_nixie",
  name: "Technomancer Nixie Codeflare",
  faction: "Cyber Dwarves",
  HP: 2, ATK: 1, DEF: 2, PSY: 4, RES: 2,
  spawn: 16,
  img: "./assets/chars/cd_nixie.jpg",
  pawn: "./assets/pawns/cd_nixie.png"
},

// Graveborn
{
  id: "gb_vargash",
  name: "Vargash \"The Butcher\" Bonebrand",
  faction: "Graveborn",
  HP: 3, ATK: 5, DEF: 2, PSY: 1, RES: 1,
  spawn: 18,
  img: "./assets/chars/gb_vargash.jpg",
  pawn: "./assets/pawns/gb_vargash.png"
},
{
  id: "gb_grimmor",
  name: "Grimmor \"Chains\" Rustheart",
  faction: "Graveborn",
  HP: 5, ATK: 2, DEF: 4, PSY: 0, RES: 2,
  spawn: 20,
  img: "./assets/chars/gb_grimmor.jpg",
  pawn: "./assets/pawns/gb_grimmor.png"
},
{
  id: "gb_mirelda",
  name: "Mirelda \"Granny Grave\" Whisperveil",
  faction: "Graveborn",
  HP: 2, ATK: 1, DEF: 2, PSY: 5, RES: 2,
  spawn: 22,
  img: "./assets/chars/gb_mirelda.jpg",
  pawn: "./assets/pawns/gb_mirelda.png"
}
];
