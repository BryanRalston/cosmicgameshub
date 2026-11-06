export const prefabs = {
  // ==================== BUILDING STRUCTURES ====================
  wall4: [
    {type:'2x4',dx:0,dy:0,dz:0,rot:0},
    {type:'2x4',dx:0,dy:3,dz:0,rot:0},
    {type:'2x4',dx:0,dy:6,dz:0,rot:0}
  ],
  wall8: [
    {type:'2x4',dx:0,dy:0,dz:0,rot:0},{type:'2x4',dx:4,dy:0,dz:0,rot:0},
    {type:'2x4',dx:2,dy:3,dz:0,rot:0},{type:'2x4',dx:-2,dy:3,dz:0,rot:0},
    {type:'2x4',dx:0,dy:6,dz:0,rot:0},{type:'2x4',dx:4,dy:6,dz:0,rot:0}
  ],
  corner: [
    {type:'2x2',dx:0,dy:0,dz:0,rot:0},{type:'2x2',dx:0,dy:3,dz:0,rot:0},{type:'2x2',dx:0,dy:6,dz:0,rot:0},
    {type:'2x2',dx:2,dy:0,dz:0,rot:0},{type:'2x2',dx:2,dy:3,dz:0,rot:0},{type:'2x2',dx:2,dy:6,dz:0,rot:0},
    {type:'2x2',dx:0,dy:0,dz:2,rot:0},{type:'2x2',dx:0,dy:3,dz:2,rot:0},{type:'2x2',dx:0,dy:6,dz:2,rot:0}
  ],
  pillar: [
    {type:'2x2',dx:0,dy:0,dz:0,rot:0},{type:'2x2',dx:0,dy:3,dz:0,rot:0},
    {type:'2x2',dx:0,dy:6,dz:0,rot:0},{type:'2x2',dx:0,dy:9,dz:0,rot:0}
  ],
  stairs: [
    {type:'2x4',dx:0,dy:0,dz:0,rot:0},{type:'2x4',dx:0,dy:3,dz:2,rot:0},
    {type:'2x4',dx:0,dy:6,dz:4,rot:0},{type:'2x4',dx:0,dy:9,dz:6,rot:0}
  ],
  arch: [
    {type:'1x2',dx:0,dy:0,dz:0,rot:90},{type:'1x2',dx:0,dy:3,dz:0,rot:90},{type:'1x2',dx:0,dy:6,dz:0,rot:90},{type:'1x2',dx:0,dy:9,dz:0,rot:90},
    {type:'1x2',dx:4,dy:0,dz:0,rot:90},{type:'1x2',dx:4,dy:3,dz:0,rot:90},{type:'1x2',dx:4,dy:6,dz:0,rot:90},{type:'1x2',dx:4,dy:9,dz:0,rot:90},
    {type:'2x6',dx:0,dy:12,dz:0,rot:90}
  ],
  window: [
    {type:'2x6',dx:0,dy:0,dz:0,rot:90},
    {type:'1x2',dx:0,dy:3,dz:0,rot:0},{type:'1x2',dx:0,dy:6,dz:0,rot:0},
    {type:'1x2',dx:5,dy:3,dz:0,rot:0},{type:'1x2',dx:5,dy:6,dz:0,rot:0},
    {type:'2x6',dx:0,dy:9,dz:0,rot:90},
    {type:'2x4',dx:1,dy:3,dz:0,rot:90,color:0xb3e5fc,transparent:true},
    {type:'2x4',dx:1,dy:6,dz:0,rot:90,color:0xb3e5fc,transparent:true}
  ],
  door: [
    {type:'1x2',dx:0,dy:0,dz:0,rot:0},{type:'1x2',dx:0,dy:3,dz:0,rot:0},{type:'1x2',dx:0,dy:6,dz:0,rot:0},{type:'1x2',dx:0,dy:9,dz:0,rot:0},{type:'1x2',dx:0,dy:12,dz:0,rot:0},
    {type:'1x2',dx:5,dy:0,dz:0,rot:0},{type:'1x2',dx:5,dy:3,dz:0,rot:0},{type:'1x2',dx:5,dy:6,dz:0,rot:0},{type:'1x2',dx:5,dy:9,dz:0,rot:0},{type:'1x2',dx:5,dy:12,dz:0,rot:0},
    {type:'2x6',dx:0,dy:15,dz:0,rot:90},
    {type:'2x4',dx:1,dy:0,dz:0,rot:90,color:0x8d6e63},{type:'2x4',dx:1,dy:3,dz:0,rot:90,color:0x8d6e63},{type:'2x4',dx:1,dy:6,dz:0,rot:90,color:0x8d6e63},{type:'2x4',dx:1,dy:9,dz:0,rot:90,color:0x8d6e63},{type:'2x4',dx:1,dy:12,dz:0,rot:90,color:0x8d6e63}
  ],
  fence: [
    {type:'1x1',dx:0,dy:0,dz:0,rot:0,color:0x8d6e63},{type:'1x1',dx:0,dy:3,dz:0,rot:0,color:0x8d6e63},
    {type:'1x4p',dx:0,dy:4,dz:0,rot:0,color:0x8d6e63},
    {type:'1x1',dx:0,dy:0,dz:3,rot:0,color:0x8d6e63},{type:'1x1',dx:0,dy:3,dz:3,rot:0,color:0x8d6e63}
  ],
  
  // ==================== NATURAL - TREES ====================
  tree: [
    // Classic deciduous tree with fuller canopy
    {type:'r2x2',dx:0,dy:0,dz:0,rot:0,color:0x5d4037},{type:'r2x2',dx:0,dy:3,dz:0,rot:0,color:0x6d4c41},
    // Lower canopy layer
    {type:'2x2',dx:-2,dy:6,dz:0,rot:0,color:0x1b5e20},{type:'2x2',dx:2,dy:6,dz:0,rot:0,color:0x2e7d32},
    {type:'2x2',dx:0,dy:6,dz:-2,rot:0,color:0x2e7d32},{type:'2x2',dx:0,dy:6,dz:2,rot:0,color:0x1b5e20},
    {type:'2x2',dx:-1,dy:6,dz:-1,rot:0,color:0x388e3c},{type:'2x2',dx:1,dy:6,dz:-1,rot:0,color:0x43a047},
    {type:'2x2',dx:-1,dy:6,dz:1,rot:0,color:0x43a047},{type:'2x2',dx:1,dy:6,dz:1,rot:0,color:0x388e3c},
    // Upper canopy
    {type:'2x2',dx:-1,dy:9,dz:0,rot:0,color:0x4caf50},{type:'2x2',dx:1,dy:9,dz:0,rot:0,color:0x43a047},
    {type:'2x2',dx:0,dy:9,dz:-1,rot:0,color:0x43a047},{type:'2x2',dx:0,dy:9,dz:1,rot:0,color:0x4caf50},
    // Top
    {type:'2x2',dx:0,dy:12,dz:0,rot:0,color:0x66bb6a}
  ],
  pine: [
    // Tall conifer with tiered branches
    {type:'r1x1',dx:0,dy:0,dz:0,rot:0,color:0x4e342e},{type:'r1x1',dx:0,dy:3,dz:0,rot:0,color:0x5d4037},{type:'r1x1',dx:0,dy:6,dz:0,rot:0,color:0x6d4c41},
    // Bottom tier - widest
    {type:'slope2',dx:-2,dy:6,dz:-1,rot:180,color:0x1b5e20},{type:'slope2',dx:1,dy:6,dz:-1,rot:180,color:0x2e7d32},
    {type:'slope2',dx:-2,dy:6,dz:1,rot:0,color:0x2e7d32},{type:'slope2',dx:1,dy:6,dz:1,rot:0,color:0x1b5e20},
    {type:'slope2',dx:-1,dy:6,dz:-2,rot:90,color:0x2e7d32},{type:'slope2',dx:-1,dy:6,dz:1,rot:270,color:0x1b5e20},
    {type:'2x2',dx:-1,dy:6,dz:-1,rot:0,color:0x388e3c},{type:'2x2',dx:1,dy:6,dz:-1,rot:0,color:0x2e7d32},
    {type:'2x2',dx:-1,dy:6,dz:1,rot:0,color:0x2e7d32},{type:'2x2',dx:1,dy:6,dz:1,rot:0,color:0x388e3c},
    // Middle tier
    {type:'2x2',dx:-1,dy:9,dz:-1,rot:0,color:0x388e3c},{type:'2x2',dx:1,dy:9,dz:-1,rot:0,color:0x43a047},
    {type:'2x2',dx:-1,dy:9,dz:1,rot:0,color:0x43a047},{type:'2x2',dx:1,dy:9,dz:1,rot:0,color:0x388e3c},
    // Upper tier
    {type:'2x2',dx:0,dy:12,dz:0,rot:0,color:0x4caf50},
    // Top point
    {type:'1x1',dx:0,dy:15,dz:0,rot:0,color:0x66bb6a}
  ],
  palm: [
    // Tropical palm with textured trunk and detailed fronds
    {type:'r1x1',dx:0,dy:0,dz:0,rot:0,color:0x5d4037},{type:'r1x1',dx:0,dy:3,dz:0,rot:0,color:0x6d4c41},
    {type:'r1x1',dx:0,dy:6,dz:0,rot:0,color:0x795548},{type:'r1x1',dx:0,dy:9,dz:0,rot:0,color:0x8d6e63},
    {type:'r1x1',dx:0,dy:12,dz:0,rot:0,color:0xa1887f},
    // Coconuts cluster
    {type:'r1x1p',dx:0,dy:15,dz:0,rot:0,color:0x4e342e},
    {type:'r1x1p',dx:1,dy:14,dz:0,rot:0,color:0x5d4037},{type:'r1x1p',dx:-1,dy:14,dz:0,rot:0,color:0x6d4c41},
    // Fronds - 8 directions
    {type:'1x4',dx:0,dy:15,dz:-2,rot:0,color:0x558b2f},{type:'1x4',dx:0,dy:15,dz:2,rot:0,color:0x689f38},
    {type:'1x4',dx:-2,dy:15,dz:0,rot:90,color:0x689f38},{type:'1x4',dx:2,dy:15,dz:0,rot:90,color:0x558b2f},
    {type:'1x3',dx:-1,dy:15,dz:-1,rot:0,color:0x7cb342},{type:'1x3',dx:1,dy:15,dz:1,rot:0,color:0x7cb342},
    {type:'1x3',dx:-1,dy:15,dz:1,rot:90,color:0x8bc34a},{type:'1x3',dx:1,dy:15,dz:-1,rot:90,color:0x8bc34a}
  ],
  oak: [
    // Majestic oak with thick trunk and sprawling canopy
    {type:'2x2',dx:0,dy:0,dz:0,rot:0,color:0x4e342e},{type:'2x2',dx:0,dy:3,dz:0,rot:0,color:0x5d4037},
    {type:'2x2',dx:0,dy:6,dz:0,rot:0,color:0x6d4c41},
    // Branches extending from trunk
    {type:'1x2',dx:-2,dy:6,dz:0,rot:90,color:0x5d4037},{type:'1x2',dx:2,dy:6,dz:0,rot:90,color:0x5d4037},
    // Main canopy - large spread
    {type:'4x4',dx:-1,dy:9,dz:-1,rot:0,color:0x2e7d32},
    {type:'2x4',dx:-3,dy:9,dz:-1,rot:0,color:0x388e3c},{type:'2x4',dx:3,dy:9,dz:-1,rot:0,color:0x1b5e20},
    {type:'2x4',dx:-1,dy:9,dz:-3,rot:90,color:0x1b5e20},{type:'2x4',dx:-1,dy:9,dz:3,rot:90,color:0x388e3c},
    // Upper canopy
    {type:'4x4',dx:-1,dy:12,dz:-1,rot:0,color:0x43a047},
    {type:'2x2',dx:-2,dy:12,dz:0,rot:0,color:0x4caf50},{type:'2x2',dx:2,dy:12,dz:0,rot:0,color:0x4caf50},
    {type:'2x2',dx:0,dy:12,dz:-2,rot:0,color:0x4caf50},{type:'2x2',dx:0,dy:12,dz:2,rot:0,color:0x4caf50},
    // Top crown
    {type:'2x2',dx:0,dy:15,dz:0,rot:0,color:0x66bb6a}
  ],
  deadTree: [
    // Spooky dead tree with gnarled branches
    {type:'r1x1',dx:0,dy:0,dz:0,rot:0,color:0x3e2723},{type:'r1x1',dx:0,dy:3,dz:0,rot:0,color:0x4e342e},
    {type:'r1x1',dx:0,dy:6,dz:0,rot:0,color:0x5d4037},{type:'r1x1',dx:0,dy:9,dz:0,rot:0,color:0x4e342e},
    // Main branches
    {type:'1x2',dx:-1,dy:9,dz:0,rot:90,color:0x4e342e},{type:'1x2',dx:1,dy:9,dz:0,rot:90,color:0x5d4037},
    {type:'1x2',dx:0,dy:9,dz:-1,rot:0,color:0x5d4037},{type:'1x2',dx:0,dy:9,dz:1,rot:0,color:0x4e342e},
    // Branch tips
    {type:'1x1',dx:-3,dy:9,dz:0,rot:0,color:0x3e2723},{type:'1x1',dx:3,dy:9,dz:0,rot:0,color:0x3e2723},
    {type:'1x1',dx:-2,dy:12,dz:0,rot:0,color:0x4e342e},{type:'1x1',dx:2,dy:12,dz:0,rot:0,color:0x4e342e},
    {type:'1x1',dx:0,dy:12,dz:0,rot:0,color:0x5d4037}
  ],
  willow: [
    // Weeping willow with drooping branches
    {type:'r2x2',dx:0,dy:0,dz:0,rot:0,color:0x5d4037},{type:'r2x2',dx:0,dy:3,dz:0,rot:0,color:0x6d4c41},
    {type:'r2x2',dx:0,dy:6,dz:0,rot:0,color:0x795548},
    // Crown
    {type:'2x2',dx:-1,dy:9,dz:-1,rot:0,color:0x7cb342},{type:'2x2',dx:1,dy:9,dz:-1,rot:0,color:0x8bc34a},
    {type:'2x2',dx:-1,dy:9,dz:1,rot:0,color:0x8bc34a},{type:'2x2',dx:1,dy:9,dz:1,rot:0,color:0x7cb342},
    // Drooping branches (using plates to simulate hanging)
    {type:'1x1p',dx:-2,dy:6,dz:-1,rot:0,color:0x9ccc65},{type:'1x1p',dx:-2,dy:5,dz:-1,rot:0,color:0xaed581},
    {type:'1x1p',dx:-2,dy:4,dz:-1,rot:0,color:0xc5e1a5},{type:'1x1p',dx:-2,dy:3,dz:-1,rot:0,color:0xdcedc8},
    {type:'1x1p',dx:3,dy:6,dz:0,rot:0,color:0x9ccc65},{type:'1x1p',dx:3,dy:5,dz:0,rot:0,color:0xaed581},
    {type:'1x1p',dx:3,dy:4,dz:0,rot:0,color:0xc5e1a5},{type:'1x1p',dx:3,dy:3,dz:0,rot:0,color:0xdcedc8},
    {type:'1x1p',dx:0,dy:6,dz:-2,rot:0,color:0x9ccc65},{type:'1x1p',dx:0,dy:5,dz:-2,rot:0,color:0xaed581},
    {type:'1x1p',dx:0,dy:4,dz:-2,rot:0,color:0xc5e1a5},
    {type:'1x1p',dx:0,dy:6,dz:3,rot:0,color:0x9ccc65},{type:'1x1p',dx:0,dy:5,dz:3,rot:0,color:0xaed581},
    {type:'1x1p',dx:0,dy:4,dz:3,rot:0,color:0xc5e1a5}
  ],
  cherry: [
    // Cherry blossom tree with pink flowers
    {type:'r2x2',dx:0,dy:0,dz:0,rot:0,color:0x4e342e},{type:'r2x2',dx:0,dy:3,dz:0,rot:0,color:0x5d4037},
    // Branches
    {type:'1x2',dx:-2,dy:6,dz:0,rot:90,color:0x5d4037},{type:'1x2',dx:2,dy:6,dz:0,rot:90,color:0x5d4037},
    // Pink blossom canopy
    {type:'2x2',dx:-2,dy:6,dz:-1,rot:0,color:0xf8bbd9},{type:'2x2',dx:2,dy:6,dz:-1,rot:0,color:0xf48fb1},
    {type:'2x2',dx:-2,dy:6,dz:1,rot:0,color:0xf48fb1},{type:'2x2',dx:2,dy:6,dz:1,rot:0,color:0xf8bbd9},
    {type:'2x2',dx:-1,dy:6,dz:-2,rot:0,color:0xf48fb1},{type:'2x2',dx:1,dy:6,dz:-2,rot:0,color:0xf8bbd9},
    {type:'2x2',dx:-1,dy:6,dz:2,rot:0,color:0xf8bbd9},{type:'2x2',dx:1,dy:6,dz:2,rot:0,color:0xf48fb1},
    {type:'2x2',dx:-1,dy:9,dz:-1,rot:0,color:0xfce4ec},{type:'2x2',dx:1,dy:9,dz:-1,rot:0,color:0xf8bbd9},
    {type:'2x2',dx:-1,dy:9,dz:1,rot:0,color:0xf8bbd9},{type:'2x2',dx:1,dy:9,dz:1,rot:0,color:0xfce4ec},
    {type:'2x2',dx:0,dy:12,dz:0,rot:0,color:0xfce4ec}
  ],
  
  // ==================== NATURAL - PLANTS & FLOWERS ====================
  bush: [
    // Full rounded bush with layered foliage
    {type:'2x2',dx:-1,dy:0,dz:-1,rot:0,color:0x1b5e20},{type:'2x2',dx:1,dy:0,dz:-1,rot:0,color:0x2e7d32},
    {type:'2x2',dx:-1,dy:0,dz:1,rot:0,color:0x2e7d32},{type:'2x2',dx:1,dy:0,dz:1,rot:0,color:0x1b5e20},
    {type:'2x2',dx:0,dy:0,dz:0,rot:0,color:0x388e3c},
    {type:'2x2',dx:0,dy:3,dz:0,rot:0,color:0x43a047},
    {type:'1x1',dx:-1,dy:3,dz:0,rot:0,color:0x4caf50},{type:'1x1',dx:2,dy:3,dz:0,rot:0,color:0x4caf50},
    {type:'1x1',dx:0,dy:3,dz:-1,rot:0,color:0x4caf50},{type:'1x1',dx:0,dy:3,dz:2,rot:0,color:0x4caf50}
  ],
  bushBerry: [
    // Berry bush with red berries
    {type:'2x2',dx:0,dy:0,dz:0,rot:0,color:0x2e7d32},
    {type:'1x1',dx:-1,dy:0,dz:0,rot:0,color:0x388e3c},{type:'1x1',dx:2,dy:0,dz:0,rot:0,color:0x388e3c},
    {type:'1x1',dx:0,dy:0,dz:-1,rot:0,color:0x388e3c},{type:'1x1',dx:0,dy:0,dz:2,rot:0,color:0x388e3c},
    {type:'2x2',dx:0,dy:3,dz:0,rot:0,color:0x43a047},
    // Berries scattered
    {type:'r1x1p',dx:-1,dy:1,dz:0,rot:0,color:0xc62828},{type:'r1x1p',dx:2,dy:2,dz:1,rot:0,color:0xd32f2f},
    {type:'r1x1p',dx:0,dy:2,dz:-1,rot:0,color:0xe53935},{type:'r1x1p',dx:1,dy:1,dz:2,rot:0,color:0xc62828}
  ],
  flowerRed: [
    // Rose bush with multiple blooms
    {type:'1x1',dx:0,dy:0,dz:0,rot:0,color:0x2e7d32},{type:'1x1',dx:0,dy:3,dz:0,rot:0,color:0x388e3c},
    {type:'r1x1',dx:0,dy:6,dz:0,rot:0,color:0xc62828},
    {type:'r1x1p',dx:-1,dy:5,dz:0,rot:0,color:0xd32f2f},{type:'r1x1p',dx:1,dy:5,dz:0,rot:0,color:0xe53935},
    {type:'r1x1p',dx:0,dy:5,dz:-1,rot:0,color:0xef5350},{type:'r1x1p',dx:0,dy:5,dz:1,rot:0,color:0xd32f2f},
    {type:'1x1p',dx:-1,dy:3,dz:0,rot:0,color:0x43a047},{type:'1x1p',dx:1,dy:3,dz:0,rot:0,color:0x43a047}
  ],
  flowerYellow: [
    // Sunflower - tall with big head
    {type:'1x1',dx:0,dy:0,dz:0,rot:0,color:0x33691e},{type:'1x1',dx:0,dy:3,dz:0,rot:0,color:0x388e3c},
    {type:'1x1',dx:0,dy:6,dz:0,rot:0,color:0x43a047},
    // Flower head
    {type:'r2x2',dx:-1,dy:9,dz:-1,rot:0,color:0xfdd835},
    {type:'r1x1p',dx:0,dy:9,dz:0,rot:0,color:0x795548},
    // Petals
    {type:'1x1p',dx:-2,dy:8,dz:0,rot:0,color:0xffeb3b},{type:'1x1p',dx:2,dy:8,dz:0,rot:0,color:0xffeb3b},
    {type:'1x1p',dx:0,dy:8,dz:-2,rot:0,color:0xffeb3b},{type:'1x1p',dx:0,dy:8,dz:2,rot:0,color:0xffeb3b},
    // Leaves
    {type:'1x2p',dx:-1,dy:4,dz:0,rot:90,color:0x4caf50},{type:'1x2p',dx:1,dy:5,dz:0,rot:90,color:0x4caf50}
  ],
  flowerPink: [
    // Peony - lush pink bloom
    {type:'1x1',dx:0,dy:0,dz:0,rot:0,color:0x2e7d32},{type:'1x1',dx:0,dy:3,dz:0,rot:0,color:0x388e3c},
    {type:'r2x2',dx:-1,dy:6,dz:-1,rot:0,color:0xec407a},
    {type:'r1x1',dx:0,dy:6,dz:0,rot:0,color:0xf48fb1},
    {type:'r1x1p',dx:-1,dy:7,dz:0,rot:0,color:0xfce4ec},{type:'r1x1p',dx:1,dy:7,dz:0,rot:0,color:0xf8bbd9},
    {type:'r1x1p',dx:0,dy:7,dz:-1,rot:0,color:0xf8bbd9},{type:'r1x1p',dx:0,dy:7,dz:1,rot:0,color:0xfce4ec},
    {type:'1x2p',dx:-1,dy:2,dz:0,rot:90,color:0x43a047},{type:'1x2p',dx:0,dy:3,dz:-1,rot:0,color:0x43a047}
  ],
  flowerBlue: [
    // Hydrangea - clustered blue flowers
    {type:'1x2',dx:0,dy:0,dz:0,rot:0,color:0x33691e},{type:'1x1',dx:0,dy:3,dz:0,rot:0,color:0x388e3c},
    {type:'2x2',dx:-1,dy:6,dz:-1,rot:0,color:0x1565c0},
    {type:'1x1',dx:-2,dy:5,dz:0,rot:0,color:0x1976d2},{type:'1x1',dx:2,dy:5,dz:0,rot:0,color:0x1e88e5},
    {type:'1x1',dx:0,dy:5,dz:-2,rot:0,color:0x1e88e5},{type:'1x1',dx:0,dy:5,dz:2,rot:0,color:0x1976d2},
    {type:'r1x1p',dx:0,dy:8,dz:0,rot:0,color:0x42a5f5},{type:'r1x1p',dx:-1,dy:7,dz:-1,rot:0,color:0x64b5f6},
    {type:'r1x1p',dx:1,dy:7,dz:1,rot:0,color:0x64b5f6},
    {type:'1x2p',dx:-1,dy:2,dz:0,rot:90,color:0x43a047},{type:'1x2p',dx:1,dy:3,dz:0,rot:90,color:0x4caf50}
  ],
  flowerWhite: [
    // Lily - elegant white flower
    {type:'1x1',dx:0,dy:0,dz:0,rot:0,color:0x2e7d32},{type:'1x1',dx:0,dy:3,dz:0,rot:0,color:0x388e3c},
    {type:'r1x1',dx:0,dy:6,dz:0,rot:0,color:0xfafafa},
    {type:'1x1p',dx:-1,dy:5,dz:0,rot:0,color:0xffffff},{type:'1x1p',dx:1,dy:5,dz:0,rot:0,color:0xeeeeee},
    {type:'1x1p',dx:0,dy:5,dz:-1,rot:0,color:0xeeeeee},{type:'1x1p',dx:0,dy:5,dz:1,rot:0,color:0xffffff},
    {type:'r1x1p',dx:0,dy:7,dz:0,rot:0,color:0xffeb3b},
    {type:'1x2p',dx:-1,dy:1,dz:0,rot:90,color:0x43a047}
  ],
  tulips: [
    // Tulip garden - taller with proper tulip shapes
    {type:'1x1',dx:0,dy:0,dz:0,rot:0,color:0x388e3c},{type:'1x1',dx:0,dy:3,dz:0,rot:0,color:0x43a047},
    {type:'r1x1',dx:0,dy:6,dz:0,rot:0,color:0xc62828},{type:'r1x1p',dx:0,dy:7,dz:0,rot:0,color:0xe53935},
    {type:'1x1',dx:2,dy:0,dz:0,rot:0,color:0x43a047},{type:'1x1',dx:2,dy:3,dz:0,rot:0,color:0x4caf50},
    {type:'r1x1',dx:2,dy:6,dz:0,rot:0,color:0xfdd835},{type:'r1x1p',dx:2,dy:7,dz:0,rot:0,color:0xffeb3b},
    {type:'1x1',dx:1,dy:0,dz:2,rot:0,color:0x388e3c},{type:'1x1',dx:1,dy:3,dz:2,rot:0,color:0x43a047},
    {type:'r1x1',dx:1,dy:6,dz:2,rot:0,color:0x7b1fa2},{type:'r1x1p',dx:1,dy:7,dz:2,rot:0,color:0x9c27b0},
    {type:'1x1',dx:3,dy:0,dz:1,rot:0,color:0x43a047},{type:'1x1',dx:3,dy:3,dz:1,rot:0,color:0x4caf50},
    {type:'r1x1',dx:3,dy:6,dz:1,rot:0,color:0xf48fb1},{type:'r1x1p',dx:3,dy:7,dz:1,rot:0,color:0xf8bbd9}
  ],
  tallGrass: [
    // Realistic grass clump with varying heights
    {type:'1x1p',dx:0,dy:0,dz:0,rot:0,color:0x558b2f},{type:'1x1p',dx:0,dy:1,dz:0,rot:0,color:0x689f38},
    {type:'1x1p',dx:0,dy:2,dz:0,rot:0,color:0x7cb342},
    {type:'1x1p',dx:1,dy:0,dz:0,rot:0,color:0x689f38},{type:'1x1p',dx:1,dy:1,dz:0,rot:0,color:0x7cb342},
    {type:'1x1p',dx:2,dy:0,dz:0,rot:0,color:0x7cb342},{type:'1x1p',dx:2,dy:1,dz:0,rot:0,color:0x8bc34a},
    {type:'1x1p',dx:2,dy:2,dz:0,rot:0,color:0x9ccc65},{type:'1x1p',dx:2,dy:3,dz:0,rot:0,color:0xaed581},
    {type:'1x1p',dx:0,dy:0,dz:1,rot:0,color:0x7cb342},{type:'1x1p',dx:0,dy:1,dz:1,rot:0,color:0x8bc34a},
    {type:'1x1p',dx:0,dy:2,dz:1,rot:0,color:0x9ccc65},
    {type:'1x1p',dx:1,dy:0,dz:1,rot:0,color:0x8bc34a},{type:'1x1p',dx:1,dy:1,dz:1,rot:0,color:0x9ccc65},
    {type:'1x1p',dx:1,dy:2,dz:1,rot:0,color:0xaed581},{type:'1x1p',dx:1,dy:3,dz:1,rot:0,color:0xc5e1a5}
  ],
  fern: [
    // Fern with fronds spreading outward
    {type:'r1x1',dx:0,dy:0,dz:0,rot:0,color:0x33691e},
    {type:'1x3p',dx:0,dy:1,dz:-1,rot:0,color:0x388e3c},{type:'1x3p',dx:0,dy:1,dz:1,rot:0,color:0x43a047},
    {type:'1x3p',dx:-1,dy:1,dz:0,rot:90,color:0x43a047},{type:'1x3p',dx:1,dy:1,dz:0,rot:90,color:0x388e3c},
    {type:'1x2p',dx:-1,dy:2,dz:-1,rot:0,color:0x4caf50},{type:'1x2p',dx:1,dy:2,dz:1,rot:0,color:0x4caf50},
    {type:'1x2p',dx:-1,dy:2,dz:1,rot:90,color:0x66bb6a},{type:'1x2p',dx:1,dy:2,dz:-1,rot:90,color:0x66bb6a}
  ],
  cactus: [
    // Saguaro cactus with arms
    {type:'r1x1',dx:0,dy:0,dz:0,rot:0,color:0x1b5e20},{type:'r1x1',dx:0,dy:3,dz:0,rot:0,color:0x2e7d32},
    {type:'r1x1',dx:0,dy:6,dz:0,rot:0,color:0x388e3c},{type:'r1x1',dx:0,dy:9,dz:0,rot:0,color:0x43a047},
    {type:'r1x1',dx:0,dy:12,dz:0,rot:0,color:0x4caf50},
    // Left arm
    {type:'1x1',dx:-1,dy:6,dz:0,rot:0,color:0x388e3c},
    {type:'r1x1',dx:-2,dy:6,dz:0,rot:0,color:0x43a047},{type:'r1x1',dx:-2,dy:9,dz:0,rot:0,color:0x4caf50},
    // Right arm
    {type:'1x1',dx:1,dy:9,dz:0,rot:0,color:0x43a047},
    {type:'r1x1',dx:2,dy:9,dz:0,rot:0,color:0x4caf50},{type:'r1x1',dx:2,dy:12,dz:0,rot:0,color:0x66bb6a},
    // Flower on top
    {type:'r1x1p',dx:0,dy:13,dz:0,rot:0,color:0xffeb3b}
  ],
  cactusSmall: [
    // Small barrel cactus
    {type:'r2x2',dx:0,dy:0,dz:0,rot:0,color:0x2e7d32},
    {type:'r2x2p',dx:0,dy:3,dz:0,rot:0,color:0x388e3c},
    {type:'r1x1p',dx:0,dy:4,dz:0,rot:0,color:0xe91e63}
  ],
  mushroom: [
    // Red spotted mushroom (Amanita style)
    {type:'r1x1',dx:0,dy:0,dz:0,rot:0,color:0xefebe9},{type:'r1x1',dx:0,dy:3,dz:0,rot:0,color:0xfafafa},
    {type:'r2x2',dx:-1,dy:6,dz:-1,rot:0,color:0xc62828},
    {type:'r2x2p',dx:-1,dy:7,dz:-1,rot:0,color:0xd32f2f},
    // White spots
    {type:'r1x1p',dx:-1,dy:7,dz:-1,rot:0,color:0xffffff},{type:'r1x1p',dx:1,dy:7,dz:0,rot:0,color:0xfafafa},
    {type:'r1x1p',dx:0,dy:7,dz:1,rot:0,color:0xffffff}
  ],
  mushroomBrown: [
    // Porcini-style mushroom
    {type:'r1x1',dx:0,dy:0,dz:0,rot:0,color:0xd7ccc8},{type:'r1x1',dx:0,dy:3,dz:0,rot:0,color:0xefebe9},
    {type:'r2x2',dx:-1,dy:6,dz:-1,rot:0,color:0x5d4037},
    {type:'r2x2p',dx:-1,dy:7,dz:-1,rot:0,color:0x6d4c41},
    {type:'r1x1p',dx:0,dy:8,dz:0,rot:0,color:0x795548}
  ],
  mushroomCluster: [
    // Cluster of small mushrooms
    {type:'r1x1',dx:0,dy:0,dz:0,rot:0,color:0xefebe9},{type:'r1x1p',dx:0,dy:3,dz:0,rot:0,color:0xbcaaa4},
    {type:'r1x1',dx:2,dy:0,dz:1,rot:0,color:0xfafafa},{type:'r1x1p',dx:2,dy:2,dz:1,rot:0,color:0xa1887f},
    {type:'r1x1p',dx:1,dy:0,dz:2,rot:0,color:0xefebe9},{type:'r1x1p',dx:1,dy:1,dz:2,rot:0,color:0x8d6e63},
    {type:'r1x1p',dx:3,dy:0,dz:0,rot:0,color:0xd7ccc8},{type:'r1x1p',dx:3,dy:1,dz:0,rot:0,color:0x795548}
  ],
  lilyPad: [
    // Lily pad with water lily flower
    {type:'r4x4p',dx:-1,dy:0,dz:-1,rot:0,color:0x2e7d32},
    {type:'r2x2p',dx:0,dy:0,dz:0,rot:0,color:0x388e3c},
    // Lily flower
    {type:'r1x1',dx:0,dy:1,dz:0,rot:0,color:0xf8bbd9},
    {type:'1x1p',dx:-1,dy:1,dz:0,rot:0,color:0xfce4ec},{type:'1x1p',dx:1,dy:1,dz:0,rot:0,color:0xfce4ec},
    {type:'1x1p',dx:0,dy:1,dz:-1,rot:0,color:0xfce4ec},{type:'1x1p',dx:0,dy:1,dz:1,rot:0,color:0xfce4ec},
    {type:'r1x1p',dx:0,dy:2,dz:0,rot:0,color:0xffeb3b}
  ],
  reeds: [
    // Cattail reeds
    {type:'1x1p',dx:0,dy:0,dz:0,rot:0,color:0x558b2f},{type:'1x1p',dx:0,dy:1,dz:0,rot:0,color:0x689f38},
    {type:'1x1p',dx:0,dy:2,dz:0,rot:0,color:0x7cb342},{type:'1x1p',dx:0,dy:3,dz:0,rot:0,color:0x8bc34a},
    {type:'r1x1',dx:0,dy:4,dz:0,rot:0,color:0x5d4037},{type:'1x1p',dx:0,dy:5,dz:0,rot:0,color:0x9ccc65},
    {type:'1x1p',dx:1,dy:0,dz:0,rot:0,color:0x689f38},{type:'1x1p',dx:1,dy:1,dz:0,rot:0,color:0x7cb342},
    {type:'1x1p',dx:1,dy:2,dz:0,rot:0,color:0x8bc34a},{type:'r1x1',dx:1,dy:3,dz:0,rot:0,color:0x6d4c41},
    {type:'1x1p',dx:2,dy:0,dz:1,rot:0,color:0x7cb342},{type:'1x1p',dx:2,dy:1,dz:1,rot:0,color:0x8bc34a},
    {type:'1x1p',dx:2,dy:2,dz:1,rot:0,color:0x9ccc65},{type:'1x1p',dx:2,dy:3,dz:1,rot:0,color:0xaed581},
    {type:'r1x1',dx:2,dy:4,dz:1,rot:0,color:0x5d4037}
  ],
  vine: [
    // Hanging vine
    {type:'1x1p',dx:0,dy:0,dz:0,rot:0,color:0x1b5e20},
    {type:'1x1p',dx:0,dy:-1,dz:0,rot:0,color:0x2e7d32},{type:'1x1p',dx:1,dy:-1,dz:0,rot:0,color:0x388e3c},
    {type:'1x1p',dx:0,dy:-2,dz:0,rot:0,color:0x388e3c},{type:'1x1p',dx:1,dy:-2,dz:1,rot:0,color:0x43a047},
    {type:'1x1p',dx:0,dy:-3,dz:1,rot:0,color:0x43a047},{type:'1x1p',dx:0,dy:-4,dz:1,rot:0,color:0x4caf50},
    {type:'1x1p',dx:1,dy:-3,dz:0,rot:0,color:0x4caf50},{type:'1x1p',dx:1,dy:-4,dz:0,rot:0,color:0x66bb6a},
    {type:'1x1p',dx:0,dy:-5,dz:0,rot:0,color:0x66bb6a}
  ],
  
  // ==================== NATURAL - ROCKS & TERRAIN ====================
  rock: [
    {type:'2x2',dx:0,dy:0,dz:0,rot:0,color:0x757575},
    {type:'1x1',dx:-1,dy:0,dz:0,rot:0,color:0x616161},{type:'1x1',dx:2,dy:0,dz:1,rot:0,color:0x9e9e9e}
  ],
  boulder: [
    {type:'2x4',dx:0,dy:0,dz:0,rot:0,color:0x616161},
    {type:'2x2',dx:0,dy:0,dz:2,rot:0,color:0x757575},{type:'2x2',dx:2,dy:0,dz:2,rot:0,color:0x9e9e9e},
    {type:'2x2',dx:1,dy:3,dz:1,rot:0,color:0x757575}
  ],
  stump: [
    {type:'r2x2',dx:0,dy:0,dz:0,rot:0,color:0x5d4037},
    {type:'r2x2p',dx:0,dy:3,dz:0,rot:0,color:0x8d6e63}
  ],
  log: [
    {type:'r2x2',dx:0,dy:0,dz:0,rot:0,color:0x5d4037},{type:'r2x2',dx:0,dy:0,dz:2,rot:0,color:0x5d4037},{type:'r2x2',dx:0,dy:0,dz:4,rot:0,color:0x5d4037}
  ],
  
  // ==================== DOMESTIC - FURNITURE ====================
  chair: [
    // Seat
    {type:'2x2p',dx:0,dy:3,dz:0,rot:0,color:0x8d6e63},
    // Legs
    {type:'1x1',dx:0,dy:0,dz:0,rot:0,color:0x5d4037},{type:'1x1',dx:1,dy:0,dz:0,rot:0,color:0x5d4037},
    {type:'1x1',dx:0,dy:0,dz:1,rot:0,color:0x5d4037},{type:'1x1',dx:1,dy:0,dz:1,rot:0,color:0x5d4037},
    // Back
    {type:'1x2',dx:0,dy:4,dz:0,rot:90,color:0x8d6e63},{type:'1x2',dx:0,dy:7,dz:0,rot:90,color:0x8d6e63}
  ],
  table: [
    // Top
    {type:'4x4p',dx:0,dy:6,dz:0,rot:0,color:0x8d6e63},
    // Legs
    {type:'1x1',dx:0,dy:0,dz:0,rot:0,color:0x5d4037},{type:'1x1',dx:0,dy:3,dz:0,rot:0,color:0x5d4037},
    {type:'1x1',dx:3,dy:0,dz:0,rot:0,color:0x5d4037},{type:'1x1',dx:3,dy:3,dz:0,rot:0,color:0x5d4037},
    {type:'1x1',dx:0,dy:0,dz:3,rot:0,color:0x5d4037},{type:'1x1',dx:0,dy:3,dz:3,rot:0,color:0x5d4037},
    {type:'1x1',dx:3,dy:0,dz:3,rot:0,color:0x5d4037},{type:'1x1',dx:3,dy:3,dz:3,rot:0,color:0x5d4037}
  ],
  coffeeTable: [
    {type:'4x4p',dx:0,dy:3,dz:0,rot:0,color:0x6d4c41},
    {type:'1x1',dx:0,dy:0,dz:0,rot:0,color:0x5d4037},{type:'1x1',dx:3,dy:0,dz:0,rot:0,color:0x5d4037},
    {type:'1x1',dx:0,dy:0,dz:3,rot:0,color:0x5d4037},{type:'1x1',dx:3,dy:0,dz:3,rot:0,color:0x5d4037}
  ],
  sofa: [
    // Base/seat cushion
    {type:'2x6',dx:0,dy:0,dz:0,rot:0,color:0x1565c0},{type:'2x6',dx:0,dy:3,dz:0,rot:0,color:0x1976d2},
    // Back
    {type:'2x6',dx:0,dy:6,dz:0,rot:0,color:0x1976d2},{type:'2x6',dx:0,dy:9,dz:0,rot:0,color:0x1e88e5},
    // Arms
    {type:'2x2',dx:0,dy:0,dz:2,rot:0,color:0x1565c0},{type:'2x2',dx:0,dy:3,dz:2,rot:0,color:0x1976d2},
    {type:'2x2',dx:4,dy:0,dz:2,rot:0,color:0x1565c0},{type:'2x2',dx:4,dy:3,dz:2,rot:0,color:0x1976d2}
  ],
  bed: [
    // Mattress
    {type:'4x6',dx:0,dy:3,dz:0,rot:0,color:0xffffff},
    // Frame
    {type:'2x6',dx:-1,dy:0,dz:0,rot:0,color:0x5d4037},{type:'2x6',dx:4,dy:0,dz:0,rot:0,color:0x5d4037},
    {type:'2x4',dx:0,dy:0,dz:-1,rot:90,color:0x5d4037},{type:'2x4',dx:0,dy:0,dz:6,rot:90,color:0x5d4037},
    // Headboard
    {type:'2x4',dx:0,dy:6,dz:-1,rot:90,color:0x6d4c41},{type:'2x4',dx:0,dy:9,dz:-1,rot:90,color:0x6d4c41},
    // Pillow
    {type:'2x2p',dx:1,dy:4,dz:0,rot:0,color:0xe3f2fd}
  ],
  desk: [
    // Desktop
    {type:'2x6',dx:0,dy:6,dz:0,rot:0,color:0x8d6e63},{type:'2x6',dx:0,dy:6,dz:2,rot:0,color:0x8d6e63},
    // Legs
    {type:'1x2',dx:0,dy:0,dz:0,rot:0,color:0x5d4037},{type:'1x2',dx:0,dy:3,dz:0,rot:0,color:0x5d4037},
    {type:'1x2',dx:5,dy:0,dz:0,rot:0,color:0x5d4037},{type:'1x2',dx:5,dy:3,dz:0,rot:0,color:0x5d4037},
    {type:'1x2',dx:0,dy:0,dz:3,rot:0,color:0x5d4037},{type:'1x2',dx:0,dy:3,dz:3,rot:0,color:0x5d4037},
    {type:'1x2',dx:5,dy:0,dz:3,rot:0,color:0x5d4037},{type:'1x2',dx:5,dy:3,dz:3,rot:0,color:0x5d4037}
  ],
  bookshelf: [
    // Frame
    {type:'1x4',dx:0,dy:0,dz:0,rot:0,color:0x5d4037},{type:'1x4',dx:0,dy:3,dz:0,rot:0,color:0x5d4037},{type:'1x4',dx:0,dy:6,dz:0,rot:0,color:0x5d4037},{type:'1x4',dx:0,dy:9,dz:0,rot:0,color:0x5d4037},{type:'1x4',dx:0,dy:12,dz:0,rot:0,color:0x5d4037},
    {type:'1x4',dx:5,dy:0,dz:0,rot:0,color:0x5d4037},{type:'1x4',dx:5,dy:3,dz:0,rot:0,color:0x5d4037},{type:'1x4',dx:5,dy:6,dz:0,rot:0,color:0x5d4037},{type:'1x4',dx:5,dy:9,dz:0,rot:0,color:0x5d4037},{type:'1x4',dx:5,dy:12,dz:0,rot:0,color:0x5d4037},
    // Shelves
    {type:'2x4',dx:1,dy:0,dz:0,rot:90,color:0x6d4c41},{type:'2x4',dx:1,dy:5,dz:0,rot:90,color:0x6d4c41},{type:'2x4',dx:1,dy:10,dz:0,rot:90,color:0x6d4c41},
    // Books
    {type:'1x1',dx:1,dy:1,dz:0,rot:0,color:0xe53935},{type:'1x1',dx:2,dy:1,dz:0,rot:0,color:0x1e88e5},{type:'1x1',dx:3,dy:1,dz:0,rot:0,color:0x43a047},{type:'1x1',dx:4,dy:1,dz:0,rot:0,color:0xfdd835},
    {type:'1x1',dx:1,dy:6,dz:0,rot:0,color:0x8e24aa},{type:'1x1',dx:2,dy:6,dz:0,rot:0,color:0xff9800},{type:'1x1',dx:3,dy:6,dz:0,rot:0,color:0x00bcd4}
  ],
  lamp: [
    // Base
    {type:'r2x2p',dx:0,dy:0,dz:0,rot:0,color:0x212121},
    // Pole
    {type:'r1x1',dx:0,dy:1,dz:0,rot:0,color:0x424242},{type:'r1x1',dx:0,dy:4,dz:0,rot:0,color:0x424242},
    // Shade
    {type:'r2x2',dx:-1,dy:7,dz:-1,rot:0,color:0xfff9c4}
  ],
  floorLamp: [
    {type:'r2x2p',dx:0,dy:0,dz:0,rot:0,color:0x212121},
    {type:'r1x1',dx:0,dy:1,dz:0,rot:0,color:0x424242},{type:'r1x1',dx:0,dy:4,dz:0,rot:0,color:0x424242},{type:'r1x1',dx:0,dy:7,dz:0,rot:0,color:0x424242},{type:'r1x1',dx:0,dy:10,dz:0,rot:0,color:0x424242},
    {type:'2x2',dx:-1,dy:13,dz:-1,rot:0,color:0xfff9c4}
  ],
  
  // ==================== DOMESTIC - RUGS & DECOR ====================
  rugSmall: [
    {type:'4x4t',dx:0,dy:0,dz:0,rot:0,color:0xb71c1c},
    {type:'2x2t',dx:1,dy:0,dz:1,rot:0,color:0xffeb3b}
  ],
  rugLarge: [
    {type:'4x6t',dx:0,dy:0,dz:0,rot:0,color:0x1a237e},
    {type:'2x4t',dx:1,dy:0,dz:1,rot:0,color:0xc5cae9},
    {type:'2x2t',dx:2,dy:0,dz:2,rot:0,color:0xffc107}
  ],
  rugRound: [
    {type:'r4x4p',dx:0,dy:0,dz:0,rot:0,color:0x4a148c},
    {type:'r2x2p',dx:0,dy:0,dz:0,rot:0,color:0x7b1fa2}
  ],
  potPlant: [
    {type:'r2x2',dx:0,dy:0,dz:0,rot:0,color:0x795548},
    {type:'1x1',dx:0,dy:3,dz:0,rot:0,color:0x33691e},{type:'1x1',dx:0,dy:6,dz:0,rot:0,color:0x43a047},
    {type:'1x1',dx:-1,dy:4,dz:0,rot:0,color:0x388e3c},{type:'1x1',dx:1,dy:5,dz:0,rot:0,color:0x2e7d32}
  ],
  vase: [
    {type:'r1x1',dx:0,dy:0,dz:0,rot:0,color:0x00838f},{type:'r1x1',dx:0,dy:3,dz:0,rot:0,color:0x0097a7},
    {type:'r1x1p',dx:-1,dy:4,dz:0,rot:0,color:0xe91e63},{type:'r1x1p',dx:1,dy:5,dz:0,rot:0,color:0xffc107},{type:'r1x1p',dx:0,dy:4,dz:1,rot:0,color:0x8e24aa}
  ],
  painting: [
    {type:'4x4t',dx:0,dy:0,dz:0,rot:0,color:0x8d6e63},
    {type:'2x2t',dx:1,dy:0,dz:0,rot:0,color:0x64b5f6},
    {type:'1x1t',dx:1,dy:0,dz:0,rot:0,color:0xfdd835},{type:'1x1t',dx:2,dy:0,dz:0,rot:0,color:0x81c784}
  ],
  clock: [
    {type:'r2x2',dx:0,dy:0,dz:0,rot:0,color:0x5d4037},
    {type:'r1x1p',dx:0,dy:0,dz:0,rot:0,color:0xffffff}
  ],
  
  // ==================== DOMESTIC - KITCHEN ====================
  fridge: [
    {type:'2x2',dx:0,dy:0,dz:0,rot:0,color:0xeceff1},{type:'2x2',dx:0,dy:3,dz:0,rot:0,color:0xeceff1},
    {type:'2x2',dx:0,dy:6,dz:0,rot:0,color:0xcfd8dc},{type:'2x2',dx:0,dy:9,dz:0,rot:0,color:0xcfd8dc},
    {type:'2x2',dx:0,dy:12,dz:0,rot:0,color:0xb0bec5},{type:'2x2p',dx:0,dy:15,dz:0,rot:0,color:0xb0bec5},
    {type:'1x1p',dx:1,dy:8,dz:-1,rot:0,color:0x424242}
  ],
  stove: [
    {type:'2x4',dx:0,dy:0,dz:0,rot:0,color:0x37474f},{type:'2x4',dx:0,dy:3,dz:0,rot:0,color:0x455a64},
    {type:'2x4t',dx:0,dy:6,dz:0,rot:0,color:0x263238},
    {type:'r1x1p',dx:0,dy:6,dz:1,rot:0,color:0x212121},{type:'r1x1p',dx:1,dy:6,dz:1,rot:0,color:0x212121},
    {type:'r1x1p',dx:0,dy:6,dz:2,rot:0,color:0x212121},{type:'r1x1p',dx:1,dy:6,dz:2,rot:0,color:0x212121}
  ],
  sink: [
    {type:'2x4',dx:0,dy:0,dz:0,rot:0,color:0x455a64},{type:'2x4',dx:0,dy:3,dz:0,rot:0,color:0x546e7a},
    {type:'2x2t',dx:0,dy:6,dz:1,rot:0,color:0x78909c},
    {type:'1x1',dx:0,dy:6,dz:0,rot:0,color:0xb0bec5}
  ],
  counter: [
    {type:'2x4',dx:0,dy:0,dz:0,rot:0,color:0x5d4037},{type:'2x4',dx:0,dy:3,dz:0,rot:0,color:0x6d4c41},
    {type:'2x4t',dx:0,dy:6,dz:0,rot:0,color:0x8d6e63}
  ],
  
  // ==================== DOMESTIC - BATHROOM ====================
  toilet: [
    {type:'2x2',dx:0,dy:0,dz:0,rot:0,color:0xfafafa},
    {type:'1x2',dx:0,dy:3,dz:0,rot:0,color:0xfafafa},{type:'1x2p',dx:0,dy:6,dz:0,rot:0,color:0xeeeeee},
    {type:'1x2',dx:0,dy:0,dz:2,rot:0,color:0xfafafa},{type:'1x2',dx:0,dy:3,dz:2,rot:0,color:0xfafafa}
  ],
  bathtub: [
    {type:'2x6',dx:0,dy:0,dz:0,rot:0,color:0xfafafa},{type:'2x6',dx:0,dy:3,dz:0,rot:0,color:0xfafafa},
    {type:'1x6',dx:0,dy:0,dz:2,rot:0,color:0xeceff1},{type:'1x6',dx:1,dy:0,dz:2,rot:0,color:0xeceff1},
    {type:'2x2t',dx:0,dy:3,dz:1,rot:0,color:0xb3e5fc}
  ],
  
  // ==================== VEHICLES ====================
  car: [
    // Chassis/undercarriage (sits between wheels)
    {type:'2x4',dx:0,dy:1,dz:0,rot:0,color:0x424242},
    // Body
    {type:'2x4',dx:0,dy:4,dz:0,rot:0,color:0xe53935},
    // Hood
    {type:'2x2p',dx:0,dy:7,dz:0,rot:0,color:0xe53935},
    // Cabin
    {type:'2x2',dx:0,dy:7,dz:2,rot:0,color:0xe53935},
    // Roof
    {type:'2x2p',dx:0,dy:10,dz:2,rot:0,color:0xe53935},
    // Windshield
    {type:'1x2t',dx:0,dy:10,dz:1,rot:90,color:0x90caf9},
    // Wheels (round plates as tires)
    {type:'r1x1',dx:-1,dy:0,dz:0,rot:0,color:0x212121},{type:'r1x1',dx:2,dy:0,dz:0,rot:0,color:0x212121},
    {type:'r1x1',dx:-1,dy:0,dz:3,rot:0,color:0x212121},{type:'r1x1',dx:2,dy:0,dz:3,rot:0,color:0x212121},
    // Headlights
    {type:'1x1p',dx:0,dy:7,dz:-1,rot:0,color:0xffeb3b},{type:'1x1p',dx:1,dy:7,dz:-1,rot:0,color:0xffeb3b}
  ],
  truck: [
    // Chassis
    {type:'2x6',dx:0,dy:1,dz:0,rot:0,color:0x424242},
    // Cab base
    {type:'2x2',dx:0,dy:4,dz:0,rot:0,color:0x1565c0},
    // Cab top
    {type:'2x2',dx:0,dy:7,dz:0,rot:0,color:0x1565c0},
    // Cab roof
    {type:'2x2p',dx:0,dy:10,dz:0,rot:0,color:0x1565c0},
    // Windshield
    {type:'1x2t',dx:0,dy:10,dz:-1,rot:90,color:0x90caf9},
    // Truck bed floor
    {type:'2x4p',dx:0,dy:4,dz:2,rot:0,color:0x37474f},
    // Truck bed sides
    {type:'1x4',dx:-1,dy:4,dz:2,rot:0,color:0x1565c0},{type:'1x4',dx:2,dy:4,dz:2,rot:0,color:0x1565c0},
    // Truck bed back
    {type:'2x2',dx:0,dy:4,dz:6,rot:90,color:0x1565c0},
    // Wheels
    {type:'r1x1',dx:-1,dy:0,dz:0,rot:0,color:0x212121},{type:'r1x1',dx:2,dy:0,dz:0,rot:0,color:0x212121},
    {type:'r1x1',dx:-1,dy:0,dz:5,rot:0,color:0x212121},{type:'r1x1',dx:2,dy:0,dz:5,rot:0,color:0x212121},
    // Headlights
    {type:'1x1p',dx:0,dy:7,dz:-1,rot:0,color:0xffeb3b},{type:'1x1p',dx:1,dy:7,dz:-1,rot:0,color:0xffeb3b}
  ],
  boat: [
    // Hull bottom
    {type:'2x6',dx:0,dy:0,dz:0,rot:0,color:0x5d4037},
    // Hull sides
    {type:'1x6',dx:-1,dy:0,dz:0,rot:0,color:0x6d4c41},{type:'1x6',dx:2,dy:0,dz:0,rot:0,color:0x6d4c41},
    {type:'1x6',dx:-1,dy:3,dz:0,rot:0,color:0x6d4c41},{type:'1x6',dx:2,dy:3,dz:0,rot:0,color:0x6d4c41},
    // Bow (front pointed)
    {type:'1x2',dx:0,dy:0,dz:-1,rot:0,color:0x5d4037},{type:'1x2',dx:0,dy:3,dz:-1,rot:0,color:0x6d4c41},
    // Stern (back)
    {type:'2x2',dx:0,dy:0,dz:6,rot:0,color:0x5d4037},{type:'2x2',dx:0,dy:3,dz:6,rot:0,color:0x6d4c41},
    // Deck
    {type:'2x4t',dx:0,dy:6,dz:1,rot:0,color:0x8d6e63},
    // Mast base
    {type:'r1x1',dx:0,dy:6,dz:2,rot:0,color:0x4e342e},{type:'r1x1',dx:0,dy:9,dz:2,rot:0,color:0x4e342e},
    {type:'r1x1',dx:0,dy:12,dz:2,rot:0,color:0x4e342e},{type:'r1x1',dx:0,dy:15,dz:2,rot:0,color:0x4e342e},
    // Sail
    {type:'2x4t',dx:1,dy:9,dz:1,rot:0,color:0xfafafa},{type:'2x4t',dx:1,dy:12,dz:1,rot:0,color:0xfafafa}
  ],
  
  // ==================== VEHICLES - FUN BUILDS ====================
  rocket: [
    // Engine base
    {type:'r2x2',dx:0,dy:0,dz:0,rot:0,color:0x424242},
    // Exhaust nozzle
    {type:'r1x1',dx:0,dy:-1,dz:0,rot:0,color:0xff5722},
    // Main body (silver)
    {type:'r2x2',dx:0,dy:3,dz:0,rot:0,color:0xb0bec5},
    {type:'r2x2',dx:0,dy:6,dz:0,rot:0,color:0xcfd8dc},
    {type:'r2x2',dx:0,dy:9,dz:0,rot:0,color:0xb0bec5},
    {type:'r2x2',dx:0,dy:12,dz:0,rot:0,color:0xcfd8dc},
    // Red stripe
    {type:'r2x2',dx:0,dy:15,dz:0,rot:0,color:0xe53935},
    {type:'r2x2',dx:0,dy:18,dz:0,rot:0,color:0xef5350},
    // Nose cone
    {type:'r2x2',dx:0,dy:21,dz:0,rot:0,color:0xb0bec5},
    {type:'r1x1',dx:0,dy:24,dz:0,rot:0,color:0xcfd8dc},
    {type:'r1x1p',dx:0,dy:27,dz:0,rot:0,color:0xff5722},
    // Fins
    {type:'slope2',dx:-2,dy:0,dz:0,rot:270,color:0xe53935},
    {type:'slope2',dx:2,dy:0,dz:0,rot:90,color:0xe53935},
    {type:'slope2',dx:0,dy:0,dz:-2,rot:0,color:0xe53935},
    {type:'slope2',dx:0,dy:0,dz:2,rot:180,color:0xe53935},
    // Windows
    {type:'r1x1p',dx:0,dy:10,dz:1,rot:0,color:0x42a5f5},
    {type:'r1x1p',dx:0,dy:13,dz:1,rot:0,color:0x42a5f5}
  ],
  castleTower: [
    // Base foundation
    {type:'4x4',dx:0,dy:0,dz:0,rot:0,color:0x757575},
    // Tower body
    {type:'4x4',dx:0,dy:3,dz:0,rot:0,color:0x9e9e9e},
    {type:'4x4',dx:0,dy:6,dz:0,rot:0,color:0x9e9e9e},
    {type:'4x4',dx:0,dy:9,dz:0,rot:0,color:0xbdbdbd},
    {type:'4x4',dx:0,dy:12,dz:0,rot:0,color:0x9e9e9e},
    {type:'4x4',dx:0,dy:15,dz:0,rot:0,color:0xbdbdbd},
    {type:'4x4',dx:0,dy:18,dz:0,rot:0,color:0x9e9e9e},
    {type:'4x4',dx:0,dy:21,dz:0,rot:0,color:0xbdbdbd},
    {type:'4x4',dx:0,dy:24,dz:0,rot:0,color:0x9e9e9e},
    // Window slits
    {type:'1x1t',dx:1,dy:9,dz:-1,rot:0,color:0x424242},
    {type:'1x1t',dx:2,dy:15,dz:-1,rot:0,color:0x424242},
    {type:'1x1t',dx:1,dy:21,dz:-1,rot:0,color:0x424242},
    // Battlements (crenellations)
    {type:'2x2',dx:0,dy:27,dz:0,rot:0,color:0x757575},
    {type:'2x2',dx:2,dy:27,dz:2,rot:0,color:0x757575},
    {type:'1x1',dx:0,dy:27,dz:3,rot:0,color:0x616161},
    {type:'1x1',dx:3,dy:27,dz:0,rot:0,color:0x616161},
    // Flag pole
    {type:'r1x1',dx:1,dy:30,dz:1,rot:0,color:0x5d4037},
    {type:'r1x1',dx:1,dy:33,dz:1,rot:0,color:0x5d4037},
    // Flag
    {type:'1x2p',dx:2,dy:33,dz:1,rot:90,color:0xe53935},
    {type:'1x2p',dx:2,dy:34,dz:1,rot:90,color:0xfdd835}
  ],
  airplane: [
    // Fuselage
    {type:'r2x2',dx:0,dy:0,dz:0,rot:0,color:0xfafafa},
    {type:'r2x2',dx:0,dy:0,dz:2,rot:0,color:0xfafafa},
    {type:'r2x2',dx:0,dy:0,dz:4,rot:0,color:0xfafafa},
    {type:'r2x2',dx:0,dy:0,dz:6,rot:0,color:0xfafafa},
    // Nose
    {type:'r1x1',dx:0,dy:0,dz:-1,rot:0,color:0x42a5f5},
    // Cockpit windows
    {type:'1x2t',dx:0,dy:1,dz:0,rot:0,color:0x90caf9},
    // Wings
    {type:'2x6',dx:-4,dy:0,dz:2,rot:0,color:0xfafafa},
    {type:'2x6',dx:2,dy:0,dz:2,rot:0,color:0xfafafa},
    // Tail fin
    {type:'1x2',dx:0,dy:3,dz:6,rot:0,color:0xe53935},
    {type:'1x1p',dx:0,dy:6,dz:7,rot:0,color:0xe53935},
    // Horizontal stabilizers
    {type:'1x3',dx:-2,dy:0,dz:6,rot:0,color:0xfafafa},
    {type:'1x3',dx:1,dy:0,dz:6,rot:0,color:0xfafafa},
    // Engine (under wing)
    {type:'r1x1',dx:-2,dy:-1,dz:3,rot:0,color:0x757575},
    {type:'r1x1',dx:2,dy:-1,dz:3,rot:0,color:0x757575}
  ]
};
