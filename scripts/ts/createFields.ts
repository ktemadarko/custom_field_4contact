// ============================================================================
// FILE: scripts/ts/createFields.ts
// PURPOSE: A library of functions to generate Salesforce metadata XML files.
// ============================================================================

// Import 'fs' to let us Read and Write files on your computer.
import * as fs from 'fs';
// Import 'path' to correctly create file addresses (like C:\Users\...)
import * as path from 'path';

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
// A Record is just a list of key-value pairs (like Name: "Villa").
export interface RecordDefinition {
    [key: string]: any;    // Allows any property name (e.g. Price__c: 500)
}

// Rule: Configuration for the Object's main "Name" column (Text vs AutoNumber).
export interface NameFieldOptions {
    label: string;                  // e.g. "Offer Name" or "Offer ID"
    type: 'Text' | 'AutoNumber';    // Manual Text or Automatic ID
    displayFormat?: string;         // Required for AutoNumber (e.g. "OF-{0000}")
    startingNumber?: number;        // Required for AutoNumber (e.g. 1)
}

// A list of Standard Objects (like Account) that don't need the '__c' suffix.
const STANDARD_OBJECTS = ['Account', 'Contact', 'Opportunity', 'Lead', 'Case'];

// ============================================================================
// HELPER: Get Correct Names
// ============================================================================
// This function figures out if we need to add '__c' to the end of a name.
function getObjectDetails(objectName: string) {
    // Check if the name is in our Standard Objects list.
    const isStandard = STANDARD_OBJECTS.includes(objectName);
    // Check if the user already typed '__c'.
    const hasSuffix = objectName.endsWith('__c');

    let apiName = objectName;
    let folderName = objectName;

    // Logic: If it's NOT standard (like Account) and doesn't have suffix, add '__c'.
    if (!isStandard && !hasSuffix) {
        apiName = `${objectName}__c`;
        folderName = `${objectName}__c`;
    }
    // Return the cleaned-up names.
    return { apiName, folderName };
}

// ============================================================================
// HELPER: Find Fields
// ============================================================================
// Scans the folder to see which fields are marked as <required>true</required>.
export function findFields(targetObject: string, rootDir: string): string[] {
    // Get correct folder name
    const { folderName } = getObjectDetails(targetObject);
    const objectFolder = path.join(rootDir, folderName);
    const fieldsFolder = path.join(objectFolder, 'fields');

    // If folder doesn't exist, stop.
    if (!fs.existsSync(fieldsFolder)) return [];

    // Read all files in the fields folder
    const files = fs.readdirSync(fieldsFolder);
    const requiredFields: string[] = [];

    // Loop through files to find required ones
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
// PURPOSE: Generates a Permission Set XML to grant users access to the new object.
// ============================================================================

// Helper to determine API Name
function getApiName(objectName: string): string {
    const STANDARD_OBJECTS = ['Account', 'Contact', 'Opportunity', 'Lead', 'Case'];
    const isStandard = STANDARD_OBJECTS.includes(objectName);
    const hasSuffix = objectName.endsWith('__c');
    return (!isStandard && !hasSuffix) ? `${objectName}__c` : objectName;
}

export function createPermissionSet(targetObject: string, rootDir: string): void {
    const apiName = getApiName(targetObject);
    const permSetFolder = path.join(rootDir, '..', 'permissionsets');
    
    if (!fs.existsSync(permSetFolder)) {
        fs.mkdirSync(permSetFolder, { recursive: true });
    }

    // 1. Scan fields folder to find fields to enable
    const fieldsFolder = path.join(rootDir, apiName, 'fields');
    let fieldPermissions = '';

    if (fs.existsSync(fieldsFolder)) {
        const files = fs.readdirSync(fieldsFolder);
        files.forEach(file => {
            const fieldName = file.replace('.field-meta.xml', '');
            // Grant Read/Edit access to each field found
            fieldPermissions += `
    <fieldPermissions>
        <editable>true</editable>
        <field>${apiName}.${fieldName}</field>
        <readable>true</readable>
    </fieldPermissions>`;
        });
    }

    // 2. Build XML Content
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>${targetObject} Manager</label>
    <hasActivationRequired>false</hasActivationRequired>
    
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>true</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>true</modifyAllRecords>
        <object>${apiName}</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
    
    ${fieldPermissions}
    
    <tabSettings>
        <tab>${apiName}</tab>
        <visibility>Visible</visibility>
    </tabSettings>
</PermissionSet>`;

    const fileName = `${targetObject}_Manager.permissionset-meta.xml`;
    fs.writeFileSync(path.join(permSetFolder, fileName), xmlContent);
    console.log(`🔑 Created Permission Set: ${fileName}`);
}

// ============================================================================
// FUNCTION: Create Records (Data JSON)
// ============================================================================
// This function generates the JSON file to import data.
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
    
    // Loop through every record provided
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
        // Return the formatted record with Salesforce attributes
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
    
    // Write the file to disk
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

    // Create the folders if they don't exist
    if (!fs.existsSync(fieldsFolder)) fs.mkdirSync(fieldsFolder, { recursive: true });

    // Generate XML for the "Name" field (Column A)
    let nameFieldXml = '';
    // If no options provided, default to a Text field
    if (!nameFieldOptions) {
        // Default: Standard Text Name
        nameFieldXml = `<nameField><label>${label} Name</label><type>Text</type></nameField>`;
    } else {
        if (nameFieldOptions.type === 'AutoNumber') {
            // AutoNumber Configuration
            if (!nameFieldOptions.displayFormat) throw new Error("AutoNumber requires a displayFormat (e.g. OF-{0000})");
            
            // Build AutoNumber XML
            nameFieldXml = `
    <nameField>
        <displayFormat>${nameFieldOptions.displayFormat}</displayFormat>
        <label>${nameFieldOptions.label}</label>
        <type>AutoNumber</type>
        <startingNumber>${nameFieldOptions.startingNumber || 1}</startingNumber>
    </nameField>`;
        } else {
            // Explicit Text Configuration
            // Build Text XML
            nameFieldXml = `<nameField><label>${nameFieldOptions.label}</label><type>Text</type></nameField>`;
        }
    }

    // Build Main Object XML with Enterprise Features enabled
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

    // Save the file
    fs.writeFileSync(path.join(objectFolder, `${apiName}.object-meta.xml`), xmlContent);
    return fieldsFolder;
}

// ============================================================================
// FUNCTION: Create Fields (Column XMLs)
// ============================================================================
export function createFields(fieldsDir: string, fieldList: FieldDefinition[]): void {
    fieldList.forEach(field => {
        const apiName = `${field.name}__c`;
        
        // Logic: Use user label if provided, otherwise prettify the API Name
        const label = field.label ? field.label : field.name.replace(/_/g, ' '); 

        // Logic: Is it required?
        const isRequired = field.required ? 'true' : 'false';
        
        // Logic: Use description if provided, otherwise empty
        const descriptionTag = field.description ? `<description>${field.description}</description>` : '';

        // Logic: Add extra tags for specific types (Currency/Number/Text)
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

        // Build Field XML
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${apiName}</fullName>
    <label>${label}</label>
    <type>${field.type}</type>
    ${descriptionTag}
    <required>${isRequired}</required>
    ${extraTags}
</CustomField>`;

    // Save the file
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

// Save the file
    fs.writeFileSync(path.join(tabsFolder, `${apiName}.tab-meta.xml`), xmlContent);
    console.log(`✨ Created Tab: ${apiName}`);
}

// ============================================================================
// FUNCTION: Add Tab to App Navigation menu (The Helper)
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
 // Save the file
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
    //addFieldToLayout('Offer-Offer Layout', 'Offer_Amount__c', ROOT_DIR);
    //addFieldToLayout('Offer-Offer Layout', 'Target_Close_Date__c', ROOT_DIR);
    
    console.log('✨ Script Finished Successfully.');
}