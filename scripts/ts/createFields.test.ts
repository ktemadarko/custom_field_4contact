// ============================================================================
// 1. IMPORTS
// ============================================================================
import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Import our functions
import { createObject, createFields, createRecords, FieldDefinition } from './createFields';

// ============================================================================
// 2. SETUP (The Sandbox)
// ============================================================================
// We create a fake file system structure for testing.
const TEST_ROOT = path.join(__dirname, 'temp_test_output');
const MOCK_OBJECTS_DIR = path.join(TEST_ROOT, 'force-app/main/default/objects');

describe('Automation Script Tests', () => {

    // Runs BEFORE every test
    beforeEach(() => {
        // Clean slate: Delete temp folder if it exists
        if (fs.existsSync(TEST_ROOT)) {
            fs.rmSync(TEST_ROOT, { recursive: true, force: true });
        }
        // Create the mock objects folder
        fs.mkdirSync(MOCK_OBJECTS_DIR, { recursive: true });
    });

    // Runs AFTER all tests finish
    afterAll(() => {
        // Final cleanup
        if (fs.existsSync(TEST_ROOT)) {
           fs.rmSync(TEST_ROOT, { recursive: true, force: true });
        }
    });

    // ========================================================================
    // TEST 1: Custom Object Creation
    // ========================================================================
    test('should create CUSTOM object folder (with __c)', () => {
        createObject(MOCK_OBJECTS_DIR, 'TestObj', 'Label', 'Plural');
        
        // Expect: TestObj__c folder
        const expectedFile = path.join(MOCK_OBJECTS_DIR, 'TestObj__c', 'TestObj__c.object-meta.xml');
        expect(fs.existsSync(expectedFile)).toBe(true);
    });

    // ========================================================================
    // TEST 2: Required Field Logic
    // ========================================================================
    test('should mark field as required in XML', () => {
        const fieldsPath = createObject(MOCK_OBJECTS_DIR, 'TestObj', 'Label', 'Plural');
        
        createFields(fieldsPath, [
            { name: 'MustHave', type: 'Text', description: 'Desc', required: true }
        ]);

        const content = fs.readFileSync(path.join(fieldsPath, 'MustHave__c.field-meta.xml'), 'utf8');
        expect(content).toContain('<required>true</required>');
    });

    // ========================================================================
    // TEST 3: Optional Field Logic
    // ========================================================================
    test('should default to required=false', () => {
        const fieldsPath = createObject(MOCK_OBJECTS_DIR, 'TestObj', 'Label', 'Plural');
        
        createFields(fieldsPath, [
            { name: 'Optional', type: 'Text', description: 'Desc' }
        ]);

        const content = fs.readFileSync(path.join(fieldsPath, 'Optional__c.field-meta.xml'), 'utf8');
        expect(content).toContain('<required>false</required>');
    });

    // ========================================================================
    // TEST 4: Record Generation (Custom Object)
    // ========================================================================
    test('should generate JSON for Custom Object with attributes', () => {
        const fieldsPath = createObject(MOCK_OBJECTS_DIR, 'MyData', 'Label', 'Plural');
        createFields(fieldsPath, [
            { name: 'Mandatory', type: 'Text', description: 'x', required: true }
        ]);

        // Create record missing the mandatory field
        const partialRecord = [{ Name: 'Test' }];

        createRecords('MyData', partialRecord, MOCK_OBJECTS_DIR);

        const expectedDataPath = path.join(TEST_ROOT, 'data', 'MyData-data.json');
        expect(fs.existsSync(expectedDataPath)).toBe(true);

        const jsonContent = fs.readFileSync(expectedDataPath, 'utf8');
        const savedData = JSON.parse(jsonContent);

        // Check attributes
        expect(savedData.records[0].attributes.type).toBe('MyData__c');
        // Check auto-null
        expect(savedData.records[0].Mandatory__c).toBe(null);
    });

    // ========================================================================
    // TEST 5: Record Generation (Standard Object Logic)
    // ========================================================================
    test('should generate JSON for Standard Object (Account) WITHOUT adding __c', () => {
        // Note: We don't need to create the object XML for this test because
        // 'findFields' will just return empty list if folder is missing. 
        // We are testing the 'attributes.type' logic here.

        const records = [{ Name: 'Acme Corp' }];
        
        // Pass 'Account' (Standard Object Name)
        createRecords('Account', records, MOCK_OBJECTS_DIR);

        const expectedDataPath = path.join(TEST_ROOT, 'data', 'Account-data.json');
        expect(fs.existsSync(expectedDataPath)).toBe(true);

        const jsonContent = fs.readFileSync(expectedDataPath, 'utf8');
        const savedData = JSON.parse(jsonContent);

        // KEY CHECK: type should be 'Account', NOT 'Account__c'
        expect(savedData.records[0].attributes.type).toBe('Account');
    });
});