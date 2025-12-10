// ============================================================================
// FILE: scripts/ts/createFields.ts
// PURPOSE: A library of functions to generate Salesforce metadata XML files.
// ============================================================================

import * as fs from 'fs';   
import * as path from 'path'; 

// ============================================================================
// DEFINITIONS
// ============================================================================

export type FieldType = 'Text' | 'Number' | 'Currency' | 'Checkbox' | 'Date' | 'DateTime' | 'Email' | 'Percent' | 'Phone' | 'Url' | 'TextArea';

export interface FieldDefinition {
    name: string;          
    label?: string;        
    type: FieldType;       
    description?: string;  
    required?: boolean;    
}

export interface RecordDefinition {
    [key: string]: any;    
}

export interface NameFieldOptions {
    label: string;                  
    type: 'Text' | 'AutoNumber';    
    displayFormat?: string;         
    startingNumber?: number;        
}

const STANDARD_OBJECTS = ['Account', 'Contact', 'Opportunity', 'Lead', 'Case'];

// ============================================================================
// HELPER: Get Correct Names
// ============================================================================
function getObjectDetails(objectName: string) {
    const isStandard = STANDARD_OBJECTS.includes(objectName);
    const hasSuffix = objectName.endsWith('__c');

    let apiName = objectName;
    let folderName = objectName;

    if (!isStandard && !hasSuffix) {
        apiName = `${objectName}__c`;
        folderName = `${objectName}__c`;
    }
    return { apiName, folderName };
}

// ============================================================================
// HELPER: Find Fields
// ============================================================================
export function findFields(targetObject: string, rootDir: string): string[] {
    const { folderName } = getObjectDetails(targetObject);
    const objectFolder = path.join(rootDir, folderName);
    const fieldsFolder = path.join(objectFolder, 'fields');

    if (!fs.existsSync(fieldsFolder)) return [];

    const files = fs.readdirSync(fieldsFolder);
    const requiredFields: string[] = [];

    files.forEach(file => {
        const content = fs.readFileSync(path.join(fieldsFolder, file), 'utf8');
        const nameMatch = content.match(/<fullName>(.*?)<\/fullName>/);
        const isRequired = content.includes('<required>true</required>');

        if (nameMatch && isRequired) {
            requiredFields.push(nameMatch[1]);
        }
    });
    return requiredFields;
}

// ============================================================================
// PERMISSION SET GENERATOR
// ============================================================================
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

    const fieldsFolder = path.join(rootDir, apiName, 'fields');
    let fieldPermissions = '';

    if (fs.existsSync(fieldsFolder)) {
        const files = fs.readdirSync(fieldsFolder);
        files.forEach(file => {
            const fieldName = file.replace('.field-meta.xml', '');
            fieldPermissions += `
    <fieldPermissions>
        <editable>true</editable>
        <field>${apiName}.${fieldName}</field>
        <readable>true</readable>
    </fieldPermissions>`;
        });
    }

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
// FUNCTION: Create Records
// ============================================================================
export function createRecords(
    targetObject: string, 
    recordList: RecordDefinition[], 
    rootDir: string,
    nameFieldOptions?: NameFieldOptions
): string {
    const { apiName } = getObjectDetails(targetObject);
    const requiredFieldNames = findFields(targetObject, rootDir);

    if (nameFieldOptions && nameFieldOptions.type === 'AutoNumber') {
        console.log(`ℹ️  Note: Object '${targetObject}' uses AutoNumber. You do not need to provide a 'Name' field.`);
    }
    
    const formattedRecords = recordList.map((record, index) => {
        if (nameFieldOptions?.type === 'AutoNumber' && record.hasOwnProperty('Name')) {
            console.log(`⚠️  Warning: Record ${index + 1} has a 'Name' value, but object is AutoNumber. Ignoring.`);
            delete record['Name']; 
        }

        requiredFieldNames.forEach(reqField => {
            if (!record.hasOwnProperty(reqField)) {
                console.log(`⚠️  Warning: Record ${index + 1} missing '${reqField}'. Auto-filling null.`);
                record[reqField] = null;
            }
        });
        
        return {
            attributes: { type: apiName, referenceId: `ref${index}` },
            ...record
        };
    });

    const dataFolder = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataFolder)) fs.mkdirSync(dataFolder, { recursive: true });

    const outputPath = path.join(dataFolder, `${targetObject}-data.json`);
    const finalOutput = { records: formattedRecords };
    
    fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 4));
    console.log(`✅ Data File Generated: ${outputPath}`);
    return outputPath;
}

// ============================================================================
// FUNCTION: Create Object
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

    if (!fs.existsSync(fieldsFolder)) fs.mkdirSync(fieldsFolder, { recursive: true });

    let nameFieldXml = '';
    if (!nameFieldOptions) {
        nameFieldXml = `<nameField><label>${label} Name</label><type>Text</type></nameField>`;
    } else {
        if (nameFieldOptions.type === 'AutoNumber') {
            if (!nameFieldOptions.displayFormat) throw new Error("AutoNumber requires a displayFormat (e.g. OF-{0000})");
            
            nameFieldXml = `
    <nameField>
        <displayFormat>${nameFieldOptions.displayFormat}</displayFormat>
        <label>${nameFieldOptions.label}</label>
        <type>AutoNumber</type>
        <startingNumber>${nameFieldOptions.startingNumber || 1}</startingNumber>
    </nameField>`;
        } else {
            nameFieldXml = `<nameField><label>${nameFieldOptions.label}</label><type>Text</type></nameField>`;
        }
    }

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
// FUNCTION: Create Fields
// ============================================================================
export function createFields(fieldsDir: string, fieldList: FieldDefinition[]): void {
    fieldList.forEach(field => {
        const apiName = `${field.name}__c`;
        const label = field.label ? field.label : field.name.replace(/_/g, ' '); 
        const isRequired = field.required ? 'true' : 'false';
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
// FUNCTION: Create Tab
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
// FUNCTION: Add Tab to App
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
    
    if (content.includes(tabTag)) {
        console.log(`ℹ️  Tab ${apiName} is already in ${targetApp}`);
        return;
    }

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
// FUNCTION: Create Layout (NEW - Creates the Layout File Locally)
// ============================================================================
export function createLayout(targetObject: string, rootDir: string): void {
    const { apiName } = getObjectDetails(targetObject);
    const layoutsFolder = path.join(rootDir, '..', 'layouts');
    
    if (!fs.existsSync(layoutsFolder)) {
        fs.mkdirSync(layoutsFolder, { recursive: true });
    }

    // Standard Salesforce Layout Structure (Information + System Info sections)
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
    <layoutSections>
        <customLabel>false</customLabel>
        <detailHeading>false</detailHeading>
        <editHeading>true</editHeading>
        <label>Information</label>
        <layoutColumns>
            <layoutItems>
                <behavior>Required</behavior>
                <field>Name</field>
            </layoutItems>
        </layoutColumns>
        <layoutColumns>
            <layoutItems>
                <behavior>Edit</behavior>
                <field>OwnerId</field>
            </layoutItems>
        </layoutColumns>
        <style>TwoColumnsTopToBottom</style>
    </layoutSections>
    <layoutSections>
        <customLabel>false</customLabel>
        <detailHeading>false</detailHeading>
        <editHeading>true</editHeading>
        <label>System Information</label>
        <layoutColumns>
            <layoutItems>
                <behavior>Readonly</behavior>
                <field>CreatedById</field>
            </layoutItems>
        </layoutColumns>
        <layoutColumns>
            <layoutItems>
                <behavior>Readonly</behavior>
                <field>LastModifiedById</field>
            </layoutItems>
        </layoutColumns>
        <style>TwoColumnsTopToBottom</style>
    </layoutSections>
    <layoutSections>
        <customLabel>true</customLabel>
        <detailHeading>false</detailHeading>
        <editHeading>true</editHeading>
        <label>Custom Links</label>
        <style>CustomLinks</style>
    </layoutSections>
</Layout>`;

    // Layout Name: "Offer__c-Offer Layout"
    // Note: Standard convention is "ObjectName-LayoutName"
    // We strip the __c from the label part to make it "Offer Layout"
    const simpleName = targetObject.replace('__c', '');
    const layoutFileName = `${apiName}-${simpleName} Layout.layout-meta.xml`;

    fs.writeFileSync(path.join(layoutsFolder, layoutFileName), xmlContent);
    console.log(`📄 Created Layout: ${layoutFileName}`);
}

// ============================================================================
// FUNCTION: Update Layout (Injects Fields)
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
        console.log(`❌ Warning: Layout '${layoutFileName}' not found.`);
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

    // Use string pattern for regex
    const regexPattern = "<layoutSections>[\\s\\S]*?<style>TwoColumns.*?</style>[\\s\\S]*?<layoutColumns>([\\s\\S]*?)</layoutColumns>";
    const twoColumnRegex = new RegExp(regexPattern);

    const match = content.match(twoColumnRegex);

    if (match) {
        const originalBlock = match[0];
        const updatedBlock = originalBlock.replace('</layoutColumns>', `${newFieldXml}\n        </layoutColumns>`);
        content = content.replace(originalBlock, updatedBlock);
        fs.writeFileSync(layoutPath, content);
        console.log(`✅ Added '${fieldName}' to layout: ${layoutName}`);
    } else {
        console.log(`⚠️  Could not find a 2-column section in ${layoutName}.`);
    }
}

// ============================================================================
// EXECUTION
// ============================================================================

const isRunningDirectly = process.argv[1] && process.argv[1].endsWith('createFields.ts');

if (isRunningDirectly) {
    console.log('🚀 Starting Automation Script...');

    const ROOT_DIR = path.join(process.cwd(), 'force-app/main/default/objects');

    // =========================================================
    // PART A: BUILD "OFFER" OBJECT
    // =========================================================
    console.log('\n--- Building Offer Object ---');
    
    // 1. Config
    const offerNameOptions: NameFieldOptions = {
        label: 'Offer Name',          
        type: 'AutoNumber',           
        displayFormat: 'OF-{0000}',   
        startingNumber: 1             
    };

    // 2. Object & Fields
    const offerPath = createObject(ROOT_DIR, 'Offer', 'Offer', 'Offers', offerNameOptions);
    
    createFields(offerPath, [
        { name: 'Offer_Amount', label: 'Offer Amount', type: 'Currency', required: true },
        { name: 'Target_Close_Date', label: 'Target Close Date', type: 'Date', required: true }
    ]);

    // 3. Tab, Layout, Permissions, App
    createTab('Offer', ROOT_DIR, 'Custom1: Heart');
    createLayout('Offer', ROOT_DIR);
    addFieldToLayout('Offer__c-Offer Layout', 'Offer_Amount__c', ROOT_DIR);
    addFieldToLayout('Offer__c-Offer Layout', 'Target_Close_Date__c', ROOT_DIR);
    createPermissionSet('Offer', ROOT_DIR); 
    addTabToApp('standard__Sales', 'Offer', ROOT_DIR);


    // =========================================================
    // PART B: BUILD "FAVORITES" OBJECT (New!)
    // =========================================================
    console.log('\n--- Building Favorites Object ---');

    // 1. Config (Favorites usually just use a Text Name, e.g., "Fav-001" or user defined)
    const favNameOptions: NameFieldOptions = {
        label: 'Favorite Name',
        type: 'Text' // Let user type a name like "My Dream Home"
    };

    // 2. Object & Fields
    // API Name: Favorite__c
    const favPath = createObject(ROOT_DIR, 'Favorite', 'Favorite', 'Favorites', favNameOptions);

    //createFields(favPath, [
        //{ 
           // name: 'Notes', 
           // label: 'Personal Notes', 
           // type: 'TextArea', 
           // description: 'Why do you like this property?', 
           // required: false 
        //},
        // In real life, you would likely have a Lookup relationship to Property here
        // For now, we will just add a Rating field
       // { 
       //     name: 'Rating', 
        //    label: 'Rating (1-5)', 
       //     type: 'Number', 
       //     description: 'Rate this property', 
       //     required: true 
       // }
   // ]);

    // 3. Tab, Layout, Permissions, App
    createTab('Favorite', ROOT_DIR, 'Custom11: Star'); // Star icon for Favorites
    addTabToApp('standard__Sales', 'Favorite', ROOT_DIR);
    
    createLayout('Favorite', ROOT_DIR);
    //addFieldToLayout('Favorite__c-Favorite Layout', 'Notes__c', ROOT_DIR);
    //addFieldToLayout('Favorite__c-Favorite Layout', 'Rating__c', ROOT_DIR);
    
    createPermissionSet('Favorite', ROOT_DIR); 
    

    console.log('\n✨ All Objects Built Successfully.');
}