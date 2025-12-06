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
        }
    });

    // ========================================================================
    // TEST 1: Object Creation
    // ========================================================================
    test('should create object folder and XML', () => {
        const fieldsPath = createObject(MOCK_OBJECTS_DIR, 'TestObj', 'Label', 'Plural');
        
        const expectedFile = path.join(MOCK_OBJECTS_DIR, 'TestObj__c', 'TestObj__c.object-meta.xml');
        expect(fs.existsSync(expectedFile)).toBe(true);
    });

    // ========================================================================
    // TEST 2: Field Creation (Required)
    // ========================================================================
    test('should mark field as required in XML', () => {
        const fieldsPath = createObject(MOCK_OBJECTS_DIR, 'TestObj', 'Label', 'Plural');
        
        createFields(fieldsPath, [
            { name: 'MustHave', type: 'Text', description: 'Desc', required: true }
        ]);

        const fileContent = fs.readFileSync(path.join(fieldsPath, 'MustHave__c.field-meta.xml'), 'utf8');
        expect(fileContent).toContain('<required>true</required>');
    });

    // ========================================================================
    // TEST 3: Field Creation (Default Optional)
    // ========================================================================
    test('should default to required=false', () => {
        const fieldsPath = createObject(MOCK_OBJECTS_DIR, 'TestObj', 'Label', 'Plural');
        
        createFields(fieldsPath, [
            { name: 'Optional', type: 'Text', description: 'Desc' }
        ]);

        const fileContent = fs.readFileSync(path.join(fieldsPath, 'Optional__c.field-meta.xml'), 'utf8');
        expect(fileContent).toContain('<required>false</required>');
    });

    // ========================================================================
    // TEST 4: Record Creation (Updated with Name field)
    // ========================================================================
    test('should generate Salesforce-ready JSON with attributes and nulls', () => {
        // A. Setup: Create the object and a REQUIRED field
        const fieldsPath = createObject(MOCK_OBJECTS_DIR, 'MyData', 'Label', 'Plural');
        createFields(fieldsPath, [
            { name: 'Mandatory', type: 'Text', description: 'x', required: true }
        ]);

        // B. Act: Create a record. 
        // We include 'Name' because it's standard, but omit 'Mandatory__c' to test the auto-null logic.
        const partialRecord = [
            { 
                Name: 'Test Record Name', // Standard field
                SomeOtherField: 'Value' 
            }
        ];

        // We pass MOCK_OBJECTS_DIR so it knows where to look for fields
        createRecords('MyData', partialRecord, MOCK_OBJECTS_DIR);

        // C. Assert: Check the JSON file
        const expectedDataPath = path.join(TEST_ROOT, 'data', 'MyData-data.json');
        
        expect(fs.existsSync(expectedDataPath)).toBe(true);

        const jsonContent = fs.readFileSync(expectedDataPath, 'utf8');
        const savedData = JSON.parse(jsonContent);

        // CHECK 1: Is it wrapped in "records"?
        expect(savedData).toHaveProperty('records');
        const firstRecord = savedData.records[0];

        // CHECK 2: Did it add the Salesforce attributes?
        expect(firstRecord).toHaveProperty('attributes');
        expect(firstRecord.attributes.type).toBe('MyData__c');

        // CHECK 3: Did it preserve the Name?
        expect(firstRecord.Name).toBe('Test Record Name');

        // CHECK 4: Did it fill the missing required field with null?
        expect(firstRecord).toHaveProperty('Mandatory__c');
        expect(firstRecord.Mandatory__c).toBe(null);
    });
});