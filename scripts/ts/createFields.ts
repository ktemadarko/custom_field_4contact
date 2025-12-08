// ============================================================================
// FILE: scripts/ts/createFields.ts
// PURPOSE: A library of functions to generate Salesforce metadata XML files.
//          This file provides the tools for runFieldsExercise.ts.
// ============================================================================

import * as fs from 'fs';   // Tool to read/write files
import * as path from 'path'; // Tool to manage folder paths
// Permission Set Generator
import { createPermissionSet } from './createPermissionSet';

// ============================================================================
// DEFINITIONS (Types & Interfaces)
// ============================================================================

// List of allowed field types in Salesforce
export type FieldType = 'Text' | 'Number' | 'Currency' | 'Checkbox' | 'Date' | 'DateTime' | 'Email' | 'Percent' | 'Phone' | 'Url' | 'TextArea';

// Configuration for a single Custom Field
export interface FieldDefinition {
    name: string;          // API Name (e.g. "Offer_Amount"). Code uses this.
    label?: string;        // UI Label (e.g. "Offer Amount"). Users see this. Optional.
    type: FieldType;       // Data Type (Currency, Date, etc.)
    description?: string;  // Help text for Admins. Optional.
    required?: boolean;    // Is this field mandatory? Optional.
}

// Configuration for a Data Record (Row)
export interface RecordDefinition {
    [key: string]: any;    // Allows any property name (e.g. Price__c: 500)
}

// Configuration for the Object's "Name" Field (Column A)
export interface NameFieldOptions {
    label: string;                  // e.g. "Offer Name" or "Offer ID"
    type: 'Text' | 'AutoNumber';    // Manual Text or Automatic ID
    displayFormat?: string;         // Required for AutoNumber (e.g. "OF-{0000}")
    startingNumber?: number;        // Required for AutoNumber (e.g. 1)
}

const STANDARD_OBJECTS = ['Account', 'Contact', 'Opportunity', 'Lead', 'Case'];

// ============================================================================
// HELPER: Get Correct Names
// ============================================================================
// Determines if we need to add '__c' to the object name.
function getObjectDetails(objectName: string) {
    const isStandard = STANDARD_OBJECTS.includes(objectName);
    const hasSuffix = objectName.endsWith('__c');

    let apiName = objectName;
    let folderName = objectName;

    // Rule: If it's NOT standard (like Account) and doesn't have suffix, add '__c'.
    if (!isStandard && !hasSuffix) {
        apiName = `${objectName}__c`;
        folderName = `${objectName}__c`;
    }
    return { apiName, folderName };
}

// ============================================================================
// HELPER: Find Fields
// ============================================================================
// Scans the folder to see which fields are marked as <required>true</required>.
export function findFields(targetObject: string, rootDir: string): string[] {
    const { folderName } = getObjectDetails(targetObject);
    const objectFolder = path.join(rootDir, folderName);
    const fieldsFolder = path.join(objectFolder, 'fields');

    if (!fs.existsSync(fieldsFolder)) return [];

    const files = fs.readdirSync(fieldsFolder);
    const requiredFields: string[] = [];

    files.forEach(file => {
        const content = fs.readFileSync(path.join(fieldsFolder, file), 'utf8');
        // Regex: Extract the API name between <fullName> tags
        const nameMatch = content.match(/<fullName>(.*?)<\/fullName>/);
        const isRequired = content.includes('<required>true</required>');

        if (nameMatch && isRequired) {
            requiredFields.push(nameMatch[1]);
        }
    });
    return requiredFields;
}

// ============================================================================
// FUNCTION: Create Records (Data JSON)
// ============================================================================
export function createRecords(
    targetObject: string, 
    recordList: RecordDefinition[], 
    rootDir: string,
    nameFieldOptions?: NameFieldOptions // Check if Name is AutoNumber
): string {
    const { apiName } = getObjectDetails(targetObject);
    const requiredFieldNames = findFields(targetObject, rootDir);

    // Alert user if object is AutoNumber
    if (nameFieldOptions && nameFieldOptions.type === 'AutoNumber') {
        console.log(`ℹ️  Note: Object '${targetObject}' uses AutoNumber. You do not need to provide a 'Name' field.`);
    }

    const formattedRecords = recordList.map((record, index) => {
        
        // Warning: Don't provide 'Name' for AutoNumber objects
        if (nameFieldOptions?.type === 'AutoNumber' && record.hasOwnProperty('Name')) {
            console.log(`⚠️  Warning: Record ${index + 1} has a 'Name' value, but object is AutoNumber. Ignoring.`);
            delete record['Name']; 
        }

        // Auto-fill missing required fields with null
        requiredFieldNames.forEach(reqField => {
            if (!record.hasOwnProperty(reqField)) {
                console.log(`⚠️  Warning: Record ${index + 1} missing '${reqField}'. Auto-filling null.`);
                record[reqField] = null;
            }
        });
        
        // Add Attributes tag (Salesforce Requirement)
        return {
            attributes: { type: apiName, referenceId: `ref${index}` },
            ...record
        };
    });

    // Write file to 'data' folder in project root
    const dataFolder = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataFolder)) fs.mkdirSync(dataFolder, { recursive: true });

    const outputPath = path.join(dataFolder, `${targetObject}-data.json`);
    const finalOutput = { records: formattedRecords };
    
    fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 4));
    console.log(`✅ Data File Generated: ${outputPath}`);
    return outputPath;
}

// ============================================================================
// FUNCTION: Create Object (Structure XML)
// ============================================================================
export function createObject(
    parentDirectory: string, 
    objectName: string, 
    label: string, 
    pluralLabel: string,
    nameFieldOptions?: NameFieldOptions 
): string {
    const { apiName, folderName } = getObjectDetails(objectName);
    const objectFolder = path.join(parentDirectory, folderName);
    const fieldsFolder = path.join(objectFolder, 'fields');

    // Create folders
    if (!fs.existsSync(fieldsFolder)) fs.mkdirSync(fieldsFolder, { recursive: true });

    // Generate XML for the "Name" field (Column A)
    let nameFieldXml = '';
    if (!nameFieldOptions) {
        // Default: Standard Text Name
        nameFieldXml = `<nameField><label>${label} Name</label><type>Text</type></nameField>`;
    } else {
        if (nameFieldOptions.type === 'AutoNumber') {
            // AutoNumber Configuration
            if (!nameFieldOptions.displayFormat) throw new Error("AutoNumber requires a displayFormat (e.g. OF-{0000})");
            
            nameFieldXml = `
    <nameField>
        <displayFormat>${nameFieldOptions.displayFormat}</displayFormat>
        <label>${nameFieldOptions.label}</label>
        <type>AutoNumber</type>
        <startingNumber>${nameFieldOptions.startingNumber || 1}</startingNumber>
    </nameField>`;
        } else {
            // Explicit Text Configuration
            nameFieldXml = `<nameField><label>${nameFieldOptions.label}</label><type>Text</type></nameField>`;
        }
    }

    // Build Object XML with Enterprise Features enabled
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${apiName}</fullName>
    <label>${label}</label>
    <pluralLabel>${pluralLabel}</pluralLabel>
    <deploymentStatus>Deployed</deploymentStatus>
    <sharingModel>ReadWrite</sharingModel>
    <enableSharing>true</enableSharing>
    <enableBulkApi>true</enableBulkApi>
    <enableStreamingApi>true</enableStreamingApi>
    <enableActivities>true</enableActivities>
    <enableReports>true</enableReports>
    <enableSearch>true</enableSearch>
    ${nameFieldXml}
</CustomObject>`;

    fs.writeFileSync(path.join(objectFolder, `${apiName}.object-meta.xml`), xmlContent);
    return fieldsFolder;
}

// ============================================================================
// PURPOSE: Adds a field to the first 2-column section of a Page Layout
// ============================================================================

export function addFieldToLayout(
    layoutName: string, 
    fieldName: string, 
    rootDir: string
): void {
    
    const layoutsFolder = path.join(rootDir, '..', 'layouts');
    const layoutFileName = layoutName.endsWith('.layout-meta.xml') ? layoutName : `${layoutName}.layout-meta.xml`;
    const layoutPath = path.join(layoutsFolder, layoutFileName);

    if (!fs.existsSync(layoutPath)) {
        console.log(`❌ Warning: Layout '${layoutFileName}' not found. skipping.`);
        return;
    }

    let content = fs.readFileSync(layoutPath, 'utf8');

    if (content.includes(`<field>${fieldName}</field>`)) {
        console.log(`ℹ️  Field '${fieldName}' already on layout '${layoutName}'.`);
        return;
    }

    const newFieldXml = `
                <layoutItems>
                    <behavior>Edit</behavior>
                    <field>${fieldName}</field>
                </layoutItems>`;

    // Finds the first 2-column section
    const twoColumnRegex = /<layoutSections>[\s\S]*?<style>TwoColumns.*?</style>[\s\S]*?<layoutColumns>([\s\S]*?)<\/layoutColumns>/;
    const match = content.match(twoColumnRegex);

    if (match) {
        const originalBlock = match[0];
        // Inserts field at the end of the first column
        const updatedBlock = originalBlock.replace('</layoutColumns>', `${newFieldXml}\n        </layoutColumns>`);
        content = content.replace(originalBlock, updatedBlock);
        fs.writeFileSync(layoutPath, content);
        console.log(`✅ Added '${fieldName}' to layout: ${layoutName}`);
    } else {
        console.log(`⚠️  Could not find a 2-column section in ${layoutName}.`);
    }
}

// ============================================================================
// FUNCTION: Create Fields (Column XMLs)
// ============================================================================
export function createFields(fieldsDir: string, fieldList: FieldDefinition[]): void {
    fieldList.forEach(field => {
        const apiName = `${field.name}__c`;
        
        // Logic: Use user label if provided, otherwise prettify the API Name
        const label = field.label ? field.label : field.name.replace(/_/g, ' '); 
        const isRequired = field.required ? 'true' : 'false';
        
        // Logic: Use description if provided, otherwise empty
        const descriptionTag = field.description ? `<description>${field.description}</description>` : '';

        let extraTags = '';
        switch (field.type) {
            case 'Currency':
            case 'Percent':
                extraTags = '<precision>18</precision>\n    <scale>2</scale>';
                break;
            case 'Number':
                extraTags = '<precision>18</precision>\n    <scale>0</scale>';
                break;
            case 'Text':
            case 'Email':
            case 'Url':
            case 'Phone':
                extraTags = '<length>255</length>';
                break;
        }

        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${apiName}</fullName>
    <label>${label}</label>
    <type>${field.type}</type>
    ${descriptionTag}
    <required>${isRequired}</required>
    ${extraTags}
</CustomField>`;

        fs.writeFileSync(path.join(fieldsDir, `${apiName}.field-meta.xml`), xmlContent);
        console.log(`   Created Field: ${apiName} (Label: "${label}")`);
    });
}

// ============================================================================
// FUNCTION: Create Tab (UI Icon)
// ============================================================================
export function createTab(targetObject: string, rootDir: string, iconStyle: string): void {
    const { apiName } = getObjectDetails(targetObject);
    const tabsFolder = path.join(rootDir, '..', 'tabs');
    if (!fs.existsSync(tabsFolder)) fs.mkdirSync(tabsFolder, { recursive: true });

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<CustomTab xmlns="http://soap.sforce.com/2006/04/metadata">
    <customObject>true</customObject>
    <motif>${iconStyle}</motif>
    <description>Created via automation script</description>
</CustomTab>`;

    fs.writeFileSync(path.join(tabsFolder, `${apiName}.tab-meta.xml`), xmlContent);
    console.log(`✨ Created Tab: ${apiName}`);
}

// ============================================================================
// FUNCTION: Add Tab to App (The Helper)
// ============================================================================
export function addTabToApp(targetApp: string, targetObject: string, rootDir: string): void {
    const { apiName } = getObjectDetails(targetObject);
    const appFileName = targetApp.endsWith('.app-meta.xml') ? targetApp : `${targetApp}.app-meta.xml`;
    const appsFolder = path.join(rootDir, '..', 'applications');
    const appPath = path.join(appsFolder, appFileName);

    if (!fs.existsSync(appPath)) {
        console.log(`❌ Error: App file ${appPath} not found.`);
        return;
    }

    let content = fs.readFileSync(appPath, 'utf8');
    const tabTag = `<tabs>${apiName}</tabs>`;
    
    // Check duplication
    if (content.includes(tabTag)) {
        console.log(`ℹ️  Tab ${apiName} is already in ${targetApp}`);
        return;
    }

    // Insert logic
    if (content.includes('</tabs>')) {
        const lastTabRegex = /(<tabs>.*?<\/tabs>)(?![\s\S]*<tabs>)/;
        content = content.replace(lastTabRegex, `$1\n    ${tabTag}`);
    } else {
        content = content.replace('</CustomApplication>', `    ${tabTag}\n</CustomApplication>`);
    }

    fs.writeFileSync(appPath, content);
    console.log(`✅ Added ${apiName} to App: ${targetApp}`);
}

// ============================================================================
// EXECUTION
// ============================================================================

const isRunningDirectly = process.argv[1] && process.argv[1].endsWith('runFieldsExercise.ts');

if (isRunningDirectly) {
    console.log('🚀 Starting Automation Script...');

    const ROOT_DIR = path.join(process.cwd(), 'force-app/main/default/objects');

    // 1. Configure AutoNumber Name
    const offerNameOptions: NameFieldOptions = {
        label: 'Offer Name',          
        type: 'AutoNumber',           
        displayFormat: 'OF-{0000}',   
        startingNumber: 1             
    };

    // 2. Create Object: Offer
    const fieldsPath = createObject(
        ROOT_DIR, 
        'Offer', 
        'Offer', 
        'Offers',
        offerNameOptions
    );

    // 3. Define Fields (Labels, Description, Required)
    const myFields: FieldDefinition[] = [
        { 
            name: 'Offer_Amount',          // API Name (becomes Offer_Amount__c)
            label: 'Offer Amount',         // UI Label (Variable nameViewerSees)
            type: 'Currency'
        },
        { 
            name: 'Target_Close_Date',     // API Name (becomes Target_Close_Date__c)
            label: 'Target Close Date',    // UI Label (Variable nameViewerSees)
            type: 'Date'
        }
    ];

    // 4. Generate Fields
    createFields(fieldsPath, myFields);

    // 5. Create Tab
    createTab('Offer', ROOT_DIR, 'Custom1: Heart');

    // 6. Create Permission Set (XML Only)
    createPermissionSet('Offer', ROOT_DIR); 

    // 7. Add to Sales App
    addTabToApp('standard__Sales', 'Offer', ROOT_DIR);

    // 8. Update Page Layouts
    addFieldToLayout('Offer-Offer Layout', 'Offer_Amount__c', ROOT_DIR);
    addFieldToLayout('Offer-Offer Layout', 'Target_Close_Date__c', ROOT_DIR);
    
    console.log('✨ Script Finished Successfully.');
}