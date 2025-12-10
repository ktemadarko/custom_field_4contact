// ============================================================================
// 1. IMPORTS
// ============================================================================
import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createObject, createFields, createRecords, FieldDefinition } from './createFields';

// ============================================================================
// 2. SETUP
// ============================================================================

// ROOT FIX: Use process.cwd() here too.
// This creates 'temp_test_output' in the very base of your project.
const TEST_ROOT = path.join(process.cwd(), 'temp_test_output');
const MOCK_OBJECTS_DIR = path.join(TEST_ROOT, 'force-app/main/default/objects');

describe('Automation Script Tests', () => {

    beforeEach(() => {
        if (fs.existsSync(TEST_ROOT)) {
            fs.rmSync(TEST_ROOT, { recursive: true, force: true });
        }
        fs.mkdirSync(MOCK_OBJECTS_DIR, { recursive: true });
    });

    afterAll(() => {
        if (fs.existsSync(TEST_ROOT)) {
           fs.rmSync(TEST_ROOT, { recursive: true, force: true });
        }
    });

    // TEST 1: Object Creation
    test('should create CUSTOM object folder (with __c)', () => {
        createObject(MOCK_OBJECTS_DIR, 'TestObj', 'Label', 'Plural');
        
        const expectedFile = path.join(MOCK_OBJECTS_DIR, 'TestObj__c', 'TestObj__c.object-meta.xml');
        expect(fs.existsSync(expectedFile)).toBe(true);
    });

    // TEST 2: Required Field Logic
    test('should mark field as required in XML', () => {
        const fieldsPath = createObject(MOCK_OBJECTS_DIR, 'TestObj', 'Label', 'Plural');
        
        createFields(fieldsPath, [
            { name: 'MustHave', type: 'Text', description: 'Desc', required: true }
        ]);

        const content = fs.readFileSync(path.join(fieldsPath, 'MustHave__c.field-meta.xml'), 'utf8');
        expect(content).toContain('<required>true</required>');
    });

    // TEST 3: Optional Field Logic
    test('should default to required=false', () => {
        const fieldsPath = createObject(MOCK_OBJECTS_DIR, 'TestObj', 'Label', 'Plural');
        
        createFields(fieldsPath, [
            { name: 'Optional', type: 'Text', description: 'Desc' }
        ]);

        const content = fs.readFileSync(path.join(fieldsPath, 'Optional__c.field-meta.xml'), 'utf8');
        expect(content).toContain('<required>false</required>');
    });

    // TEST 4: Record Generation (Custom Object)
    test('should generate JSON for Custom Object with attributes', () => {
        const fieldsPath = createObject(MOCK_OBJECTS_DIR, 'MyData', 'Label', 'Plural');
        createFields(fieldsPath, [
            { name: 'Mandatory', type: 'Text', description: 'x', required: true }
        ]);

        const partialRecord = [{ Name: 'Test' }];

        createRecords('MyData', partialRecord, MOCK_OBJECTS_DIR);

        const expectedDataPath = path.join(process.cwd(), 'data', 'MyData-data.json');
        expect(fs.existsSync(expectedDataPath)).toBe(true);

        const jsonContent = fs.readFileSync(expectedDataPath, 'utf8');
        const savedData = JSON.parse(jsonContent);

        expect(savedData.records[0].attributes.type).toBe('MyData__c');
        expect(savedData.records[0].Mandatory__c).toBe(null);
    });

    // TEST 5: Record Generation (Standard Object Logic)
    test('should generate JSON for Standard Object (Account) WITHOUT adding __c', () => {
        const records = [{ Name: 'Acme Corp' }];
        createRecords('Account', records, MOCK_OBJECTS_DIR);

        const expectedDataPath = path.join(process.cwd(), 'data', 'Account-data.json');
        expect(fs.existsSync(expectedDataPath)).toBe(true);

        const jsonContent = fs.readFileSync(expectedDataPath, 'utf8');
        const savedData = JSON.parse(jsonContent);

        expect(savedData.records[0].attributes.type).toBe('Account');
    });
});