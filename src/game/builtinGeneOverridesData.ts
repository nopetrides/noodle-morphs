// AUTO-MANAGED BY MORPHARIUM DEV GENE EDITOR
// Run "npm run dev:gene-editor" (or the VS Code "Dev Gene Editor" launch config) to edit Core & Fun genes.
// Edits saved here are compiled directly into the game and can be rolled back cleanly with git.
import type { BuiltinGeneOverridesFile } from './builtinGeneOverrides';

export const BUILTIN_GENE_OVERRIDES: BuiltinGeneOverridesFile = {
  "schemaVersion": 1,
  "genes": {
    "banana": {
      "palette1x": {
        "base": "#F0CC6A",
        "patternPrimary": "#C3B692",
        "patternSecondary": "#FDF1B9",
        "belly": "#FCF7EA",
        "outline": "#C3B692",
        "eyeIris": "#B5748A",
        "headBlush": "#EBD3F2",
        "bodyOpacity": 1,
        "pigmentWeight": 0.9
      },
      "palette2x": {
        "base": "#E8B7AB",
        "patternPrimary": "#E1B7BF",
        "patternSecondary": "#F2E29C",
        "belly": "#FCF7EA",
        "outline": "#997082",
        "eyeIris": "#B5748A",
        "headBlush": "#EBD3F2",
        "bodyOpacity": 1,
        "pigmentWeight": 0.9
      },
      "field1x": {
        "field": "voronoi_network",
        "operation": "blend",
        "strength": 0.85,
        "frequency": 0.89,
        "paramOverrides": {
          "coverage": 0.56,
          "warpStrength": 0.21,
          "blush": 0.56,
          "flankFlame": 0.15,
          "speckleAmount": 0.42,
          "scaleRelief": 0.42,
          "edgeSoftness": 0.065,
          "dorsalBias": -0.18
        }
      },
      "field2x": {
        "field": "voronoi_network",
        "operation": "blend",
        "strength": 0.82,
        "frequency": 0.89,
        "paramOverrides": {
          "coverage": 0.56,
          "warpStrength": 0.21,
          "blush": 0.58,
          "flankFlame": 0.15,
          "speckleAmount": 0.55,
          "scaleRelief": 0.42,
          "edgeSoftness": 0.065,
          "dorsalBias": -0.18
        }
      }
    }
  }
};
