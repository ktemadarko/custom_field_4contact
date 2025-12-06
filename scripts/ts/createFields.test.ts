// ============================================================================
// 1. IMPORTS
// ============================================================================
import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Import our functions from the logic file
import { createObject, createFields, createRecords, FieldDefinition } from './createFields';

// ============================================================================
// 2. SETUP (The Sandbox)
// ============================================================================
// We create a temp environment that MIMICS your real project structure.
// temp_test_output
//   ├── force-app/main/default/objects  <-- Where XML goes
//   └── data                            <-- Where JSON goes

const TEST_ROOT = path.join(__dirname, 'temp_test_output');
const MOCK_OBJECTS_DIR = path.join(TEST_ROOT, 'force-app/main/default/objects');

describe('Automation Script Tests', () => {

    // Clean up before every single test
    beforeEach(() => {
        if (fs.existsSync(TEST_ROOT)) {
            fs.rmSync(TEST_ROOT, { recursive: true, force: true });
        }
        // Create the deep folder structure
        fs.mkdirSync(MOCK_OBJECTS_DIR, { recursive: true });
    });

    // Clean up after we are finished
    afterAll(() => {
        if (fs.existsSync(TEST_ROOT)) {
           fs.rmSync(TEST_ROOT, { recursive: true, force: true });