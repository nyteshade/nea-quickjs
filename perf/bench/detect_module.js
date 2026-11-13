/* Has an import, so it is a module: top-level this is undefined. */
import * as os from 'qjs:os';
print('module:', typeof os.now, typeof this);
