// ============================================================================
// 1. IMPORTS (Testing Tools)
// ============================================================================

// Import testing functions from Vitest.
import { describe, test, expect, beforeEach, afterAll } from 'vitest';

// Import file system and path tools.
import * as fs from 'fs';
import * as path from 'path';

// Import the URL tool to fix the pathing issue in ES Modules.
import { fileURLToPath } from 'url';

// Import the functions we wrote in the other file so we can test them.
import { createObject, createFields, createRecords, FieldDefinition } from './createFields';

// ============================================================================
// 2. SETUP (The Sandbox Environment)
// ============================================================================

// Recreate '__filename' for ES Modules.
const __filename = fileURLToPath(import.meta.url);

// Recreate '__dirname' for ES Modules.
const __dirname = path.dirname(__filename);

// Define a temporary folder path for our tests.
const TEST_ROOT = path.join(__dirname, 'temp_test_output');

// Define a mock (fake) Objects directory inside that temp folder.
const MOCK_OBJECTS_DIR = path.join(TEST_ROOT, 'force-app/main/default/objects');

// Start a Test Suite named "Automation Script Tests".
describe('Automation Script Tests', () => {

    // This function runs BEFORE every single test case.
    beforeEach(() => {
        // Check if the temp folder exists from a previous run.
        if (fs.existsSync(TEST_ROOT)) {
            // If yes, delete it completely (clean slate).
            fs.rmSync(TEST_ROOT, { recursive: true, force: true });
        }
        // Create the folder structure anew.
        fs.mkdirSync(MOCK_OBJECTS_DIR, { recursive: true });
    });

    // This function runs once AFTER all tests are finished.
    afterAll(() => {
        // Clean up the mess we made.
        if (fs.existsSync(TEST_ROOT)) {
           fs.rmSync(TEST_ROOT, { recursive: true, force: true });
        }
    });

    // ========================================================================
    // TEST 1: Custom Object Creation
    // ========================================================================
    test('should create CUSTOM object folder (with __c)', () => {
        // Run the function to create a "TestObj".
        createObject(MOCK_OBJECTS_DIR, 'TestObj', 'Label', 'Plural');
        
        // Define the path where we expect the file to be.
        const expectedFile = path.join(MOCK_OBJECTS_DIR, 'TestObj__c', 'TestObj__c.object-meta.xml');
        
        // Assert: Does the file exist? It should be true.
        expect(fs.existsSync(expectedFile)).toBe(true);
    });

    // ========================================================================
    // TEST 2: Required Field Logic
    // ========================================================================
    test('should mark field as required in XML', () => {
        // Setup: Create the object folder first.
        const fieldsPath = createObject(MOCK_OBJECTS_DIR, 'TestObj', 'Label', 'Plural');
        
        // Act: Create a field that has 'required: true'.
        createFields(fieldsPath, [
            { name: 'MustHave', type: 'Text', description: 'Desc', required: true }
        ]);

        // Read the file that was generated.
        const content = fs.readFileSync(path.join(fieldsPath, 'MustHave__c.field-meta.xml'), 'utf8');
        
        // Assert: Does the text contain the required tag?
        expect(content).toContain('<required>true</required>');
    });

    // ========================================================================
    // TEST 3: Optional Field Logic
    // ========================================================================
    test('should default to required=false', () => {
        // Setup: Create the object folder.
        const fieldsPath = createObject(MOCK_OBJECTS_DIR, 'TestObj', 'Label', 'Plural');
        
        // Act: Create a field WITHOUT specifying 'required'.
        createFields(fieldsPath, [
            { name: 'Optional', type: 'Text', description: 'Desc' }
        ]);

        // Read the file.
        const content = fs.readFileSync(path.join(fieldsPath, 'Optional__c.field-meta.xml'), 'utf8');
        
        // Assert: It should default to false.
        expect(content).toContain('<required>false</required>');
    });

    // ========================================================================
    // TEST 4: Record Generation (Custom Object)
    // ========================================================================
    test('should generate JSON for Custom Object with attributes', () => {
        // Setup: Create object and a mandatory field.
        const fieldsPath = createObject(MOCK_OBJECTS_DIR, 'MyData', 'Label', 'Plural');
        createFields(fieldsPath, [
            { name: 'Mandatory', type: 'Text', description: 'x', required: true }
        ]);

        // Act: Create a record that is missing that mandatory field.
        const partialRecord = [{ Name: 'Test' }];
        createRecords('MyData', partialRecord, MOCK_OBJECTS_DIR);

        // Define expected output path.
        const expectedDataPath = path.join(TEST_ROOT, 'data', 'MyData-data.json');
        
        // Assert: File exists.
        expect(fs.existsSync(expectedDataPath)).toBe(true);

        // Read and parse the JSON.
        const jsonContent = fs.readFileSync(expectedDataPath, 'utf8');
        const savedData = JSON.parse(jsonContent);

        // Check: Did it add the correct Custom Object type?
        expect(savedData.records[0].attributes.type).toBe('MyData__c');
        
        // Check: Did it auto-fill the missing field with null?
        expect(savedData.records[0].Mandatory__c).toBe(null);
    });

    // ========================================================================
    // TEST 5: Record Generation (Standard Object Logic)
    // ========================================================================
    test('should generate JSON for Standard Object (Account) WITHOUT adding __c', () => {
        // Act: Create a record for 'Account' (a Standard Object).
        const records = [{ Name: 'Acme Corp' }];
        createRecords('Account', records, MOCK_OBJECTS_DIR);

        // Define expected output path.
        const expectedDataPath = path.join(TEST_ROOT, 'data', 'Account-data.json');
        
        // Assert: File exists.
        expect(fs.existsSync(expectedDataPath)).toBe(true);

        // Read and parse the JSON.
        const jsonContent = fs.readFileSync(expectedDataPath, 'utf8');
        const savedData = JSON.parse(jsonContent);

        // KEY CHECK: The type should be 'Account', NOT 'Account__c'.
        expect(savedData.records[0].attributes.type).toBe('Account');
    });
});