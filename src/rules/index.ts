import { ruleAl101 } from './al101.js';
import { ruleAl102 } from './al102.js';
import { ruleAl103 } from './al103.js';
import { ruleAl104 } from './al104.js';
import { ruleAl105 } from './al105.js';
import { ruleAl200 } from './al200.js';
import { ruleAl201 } from './al201.js';
import { ruleAl202 } from './al202.js';
import type { Rule } from './engine.js';

export const defaultRules: readonly Rule[] = [
  ruleAl101,
  ruleAl102,
  ruleAl103,
  ruleAl104,
  ruleAl105,
  ruleAl200,
  ruleAl201,
  ruleAl202,
];
