// ============================================================================
// 1. IMPORTS (Testing Tools)
// ============================================================================

// Import the specific testing functions we need from Vitest.
// describe: Groups tests together.
// test: Defines a single test case.
// expect: Checks if a value is what we want (e.g., expect(5).toBe(5)).
// beforeEach: Runs code before every test (good for cleanup).
// afterAll: Runs code after all tests are done.
import { describe, test, expect, beforeEach, afterAll } from 'vitest';

// Import 'fs' to check if files exist on the hard drive.
import * as fs from 'fs';

// Import 'path' to correctly write folder addresses (e.g. folder/file.xml).
import * as path from 'path';

// Import the functions we wrote in our main file so we can test them.
import { createObject, createFields, createRecords, FieldDefinition } from './createFields';

// ============================================================================
// 2. SETUP (The Sandbox Environment)
// ============================================================================

// Define a temporary folder where we will create fake files during testing.
// __dirname: This variable automatically holds the path to the folder THIS file is in.
const TEST_ROOT = path.join(__dirname, 'temp_test_output');

// Define a fake "Objects" folder inside that temp folder to mimic Salesforce.
const MOCK_OBJECTS_DIR = path.join(TEST_ROOT, 'force-app/main/default/objects');

// Start a "Test Suite" (a group of related tests).
describe('Automation Script Tests', () => {

    // ------------------------------------------------------------------------
    // SETUP: Clean the Slate
    // ------------------------------------------------------------------------
    // This runs BEFORE every single test case.
    beforeEach(() => {
        // Check: Does our temp folder exist from a previous run?
        if (fs.existsSync(TEST_ROOT)) {
            // If yes, delete it completely so we start fresh.
            fs.rmSync(TEST_ROOT, { recursive: true, force: true });
        }
        // Create the deep folder structure for our mock objects.
        fs.mkdirSync(MOCK_OBJECTS_DIR, { recursive: true });
    });

    // ------------------------------------------------------------------------
    // TEARDOWN: Clean up the Mess
    // ------------------------------------------------------------------------
    // This runs once AFTER all tests are finished.
    afterAll(() => {
        // Delete the temp folder so we don't leave junk on your computer.
        if (fs.existsSync(TEST_ROOT)) {
           fs.rmSync(TEST_ROOT, { recursive: true, force: true });
        }
    });

    // ========================================================================
    // TEST 1: Custom Object Creation
    // ========================================================================
    test('should create CUSTOM object folder (with __c)', () => {
        // ACT: Run the function to create an object named "TestObj".
        createObject(MOCK_OBJECTS_DIR, 'TestObj', 'Label', 'Plural');
        
        // ASSERT: check if the file was created in the correct place.
        // It should add '__c' automatically.
        const expectedFile = path.join(MOCK_OBJECTS_DIR, 'TestObj__c', 'TestObj__c.object-meta.xml');
        
        // We expect the file to exist (true).
        expect(fs.existsSync(expectedFile)).toBe(true);
    });

    // ========================================================================
    // TEST 2: Required Field Logic
    // ========================================================================
    test('should mark field as required in XML', () => {
        // SETUP: Create the object folder first.
        const fieldsPath = createObject(MOCK_OBJECTS_DIR, 'TestObj', 'Label', 'Plural');
        
        // ACT: Create a field and explicitly say 'required: true'.
        createFields(fieldsPath, [
            { name: 'MustHave', type: 'Text', description: 'Desc', required: true }
        ]);

        // READ: Open the file we just built.
        const content = fs.readFileSync(path.join(fieldsPath, 'MustHave__c.field-meta.xml'), 'utf8');
        
        // ASSERT: Does the text inside contain the required tag?
        expect(content).toContain('<required>true</required>');
    });

    // ========================================================================
    // TEST 3: Optional Field Logic
    // ========================================================================
    test('should default to required=false', () => {
        // SETUP: Create the object folder.
        const fieldsPath = createObject(MOCK_OBJECTS_DIR, 'TestObj', 'Label', 'Plural');
        
        // ACT: Create a field WITHOUT mentioning 'required'.
        createFields(fieldsPath, [
            { name: 'Optional', type: 'Text', description: 'Desc' }
        ]);

        // READ: Open the file.
        const content = fs.readFileSync(path.join(fieldsPath, 'Optional__c.field-meta.xml'), 'utf8');
        
        // ASSERT: It should default to false.
        expect(content).toContain('<required>false</required>');
    });

    // ========================================================================
    // TEST 4: Record Generation (Custom Object)
    // ========================================================================
    test('should generate JSON for Custom Object with attributes', () => {
        // SETUP: Create object and a mandatory field.
        const fieldsPath = createObject(MOCK_OBJECTS_DIR, 'MyData', 'Label', 'Plural');
        createFields(fieldsPath, [
            { name: 'Mandatory', type: 'Text', description: 'x', required: true }
        ]);

        // ACT: Create a record that is MISSING that mandatory field.
        const partialRecord = [{ Name: 'Test' }];
        createRecords('MyData', partialRecord, MOCK_OBJECTS_DIR);

        // ASSERT: Check if the JSON file exists.
        // Note: createRecords goes up 4 levels to find 'data'. 
        // In our test environment, it puts it in TEST_ROOT/data.
        const expectedDataPath = path.join(TEST_ROOT, 'data', 'MyData-data.json');
        expect(fs.existsSync(expectedDataPath)).toBe(true);

        // READ & PARSE: Turn the file content back into a JavaScript object.
        const jsonContent = fs.readFileSync(expectedDataPath, 'utf8');
        const savedData = JSON.parse(jsonContent);

        // CHECK 1: Did it add the correct Custom Object type?
        expect(savedData.records[0].attributes.type).toBe('MyData__c');
        
        // CHECK 2: Did it auto-fill the missing field with null?
        expect(savedData.records[0].Mandatory__c).toBe(null);
    });

    // ========================================================================
    // TEST 5: Record Generation (Standard Object Logic)
    // ========================================================================
    test('should generate JSON for Standard Object (Account) WITHOUT adding __c', () => {
        // ACT: Create a record for 'Account' (a known Standard Object).
        const records = [{ Name: 'Acme Corp' }];
        createRecords('Account', records, MOCK_OBJECTS_DIR);

        // ASSERT: Check the file path.
        const expectedDataPath = path.join(TEST_ROOT, 'data', 'Account-data.json');
        expect(fs.existsSync(expectedDataPath)).toBe(true);

        // READ & PARSE.
        const jsonContent = fs.readFileSync(expectedDataPath, 'utf8');
        const savedData = JSON.parse(jsonContent);

        // KEY CHECK: The type should be 'Account', NOT 'Account__c'.
        expect(savedData.records[0].attributes.type).toBe('Account');
    });
});