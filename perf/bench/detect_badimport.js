/* A module whose import cannot be loaded: the error must be reported. */
import { nothing } from 'no-such-module.js';
print('should not get here');
