// ============================================================================
// FILE: scripts/ts/createFieldsNLayouts.ts
// PURPOSE: Generates Salesforce metadata (Objects, Fields, Layouts)
// ============================================================================
import * as fs from 'fs';   
import * as path from 'path'; 

// ============================================================================
// 1. DEFINITIONS
// ============================================================================

export type FieldType = 'Text' | 'Number' | 'Currency' | 'Checkbox' | 'Date' | 'DateTime' | 'Email' | 'Percent' | 'Phone' | 'Url' | 'TextArea' | 'Lookup' | 'Master-Detail';

export interface FieldDefinition {
    name: string;          
    label?: string;        
    type: FieldType;       
    description?: string;  
    required?: boolean;    
    referenceTo?: string;       // e.g. "Contact" or "Property__c"
    relationshipLabel?: string; // e.g. "Favorites"
    relationshipName?: string;  // e.g. "Favorites"
}

export interface NameFieldOptions {
    label: string;                  
    type: 'Text' | 'AutoNumber';    
    displayFormat?: string;         
    startingNumber?: number;        
}

const STANDARD_OBJECTS = ['Account', 'Contact', 'Opportunity', 'Lead', 'Case'];

// ============================================================================
// 2. HELPERS
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
// 3. CORE FUNCTIONS (Object, Fields, Tab, Layout, PermSet)
// ============================================================================

export function createObject(parentDirectory: string, objectName: string, label: string, pluralLabel: string, nameFieldOptions?: NameFieldOptions): string {
    const { apiName, folderName } = getObjectDetails(objectName);
    const objectFolder = path.join(parentDirectory, folderName);
    const fieldsFolder = path.join(objectFolder, 'fields');

    if (!fs.existsSync(fieldsFolder)) fs.mkdirSync(fieldsFolder, { recursive: true });

    let nameFieldXml = '';
    if (!nameFieldOptions) {
        nameFieldXml = `<nameField><label>${label} Name</label><type>Text</type></nameField>`;
    } else {
        if (nameFieldOptions.type === 'AutoNumber') {
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

export function createFields(fieldsDir: string, fieldList: FieldDefinition[]): void {
    fieldList.forEach(field => {
        const apiName = `${field.name}__c`;
        const label = field.label ? field.label : field.name.replace(/_/g, ' '); 
        const descriptionTag = field.description ? `<description>${field.description}</description>` : '';
        
        let xmlType = field.type as string; 
        let extraTags = '';
        
        // FIX: Calculate required tag. 
        // We set it to empty string '' for Master-Detail because Salesforce forbids <required>true</required> there.
        let requiredTag = `<required>${field.required ? 'true' : 'false'}</required>`;

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
            case 'Lookup':
                if (!field.referenceTo) throw new Error(`Field ${field.name} is a Lookup but missing 'referenceTo'.`);
                extraTags = `
    <deleteConstraint>SetNull</deleteConstraint>
    <referenceTo>${field.referenceTo}</referenceTo>
    <relationshipLabel>${field.relationshipLabel || label}</relationshipLabel>
    <relationshipName>${field.relationshipName || field.name}</relationshipName>`;
                break;
            
            case 'Master-Detail':
                if (!field.referenceTo) throw new Error(`Field ${field.name} is a Master-Detail but missing 'referenceTo'.`);
                
                // XML Type must be 'MasterDetail' (no hyphen)
                xmlType = 'MasterDetail'; 
                
                // Required tag must be REMOVED for M-D fields
                requiredTag = ''; 

                extraTags = `
    <writeRequiresMasterRead>false</writeRequiresMasterRead>
    <reparentableMasterDetail>false</reparentableMasterDetail>
    <referenceTo>${field.referenceTo}</referenceTo>
    <relationshipLabel>${field.relationshipLabel || label}</relationshipLabel>
    <relationshipName>${field.relationshipName || field.name}</relationshipName>`;
                break;
        }

        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${apiName}</fullName>
    <label>${label}</label>
    <type>${xmlType}</type>
    ${descriptionTag}
    ${requiredTag}
    ${extraTags}
</CustomField>`;

        fs.writeFileSync(path.join(fieldsDir, `${apiName}.field-meta.xml`), xmlContent);
        console.log(`   Created Field: ${apiName} (Label: "${label}")`);
    });
}

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

export function createLayout(targetObject: string, rootDir: string): void {
    const { apiName } = getObjectDetails(targetObject);
    const layoutsFolder = path.join(rootDir, '..', 'layouts');
    if (!fs.existsSync(layoutsFolder)) fs.mkdirSync(layoutsFolder, { recursive: true });

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

    const simpleName = targetObject.replace('__c', '');
    const layoutFileName = `${apiName}-${simpleName} Layout.layout-meta.xml`;
    fs.writeFileSync(path.join(layoutsFolder, layoutFileName), xmlContent);
    console.log(`📄 Created Layout: ${layoutFileName}`);
}

export function createPermissionSet(targetObject: string, rootDir: string): void {
    const apiName = getObjectDetails(targetObject).apiName;
    const permSetFolder = path.join(rootDir, '..', 'permissionsets');
    if (!fs.existsSync(permSetFolder)) fs.mkdirSync(permSetFolder, { recursive: true });

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
// 4. LAYOUT UPDATE FUNCTIONS (Add Fields & Related Lists)
// ============================================================================

export function addFieldToLayout(layoutName: string, fieldName: string, rootDir: string): void {
    const layoutsFolder = path.join(rootDir, '..', 'layouts');
    const layoutFileName = layoutName.endsWith('.layout-meta.xml') ? layoutName : `${layoutName}.layout-meta.xml`;
    const layoutPath = path.join(layoutsFolder, layoutFileName);

    if (!fs.existsSync(layoutPath)) {
        console.log(`❌ Warning: Layout '${layoutFileName}' not found. Retrieve it first.`);
        return;
    }

    let content = fs.readFileSync(layoutPath, 'utf8');

    // FIX: Regex check to prevent duplicates regardless of whitespace
    const fieldRegex = new RegExp(`<field>\\s*${fieldName}\\s*<\\/field>`);
    if (fieldRegex.test(content)) {
        console.log(`ℹ️  Field '${fieldName}' already on layout '${layoutName}'.`);
        return;
    }

    const newFieldXml = `
                <layoutItems>
                    <behavior>Edit</behavior>
                    <field>${fieldName}</field>
                </layoutItems>`;

    const twoColumnRegex = /<layoutSections>[\s\S]*?<style>TwoColumns.*?<\/style>[\s\S]*?<layoutColumns>([\s\S]*?)<\/layoutColumns>/;
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

export function addRelatedListToLayout(layoutName: string, childObject: string, lookupField: string, rootDir: string): void {
    const layoutsFolder = path.join(rootDir, '..', 'layouts');
    const layoutFileName = layoutName.endsWith('.layout-meta.xml') ? layoutName : `${layoutName}.layout-meta.xml`;
    const layoutPath = path.join(layoutsFolder, layoutFileName);

    if (!fs.existsSync(layoutPath)) {
        console.log(`❌ Warning: Layout '${layoutFileName}' not found.`);
        return;
    }

    let content = fs.readFileSync(layoutPath, 'utf8');
    
    // e.g. "Favorite__c.Contact__c"
    const relatedListId = `${childObject}.${lookupField}`;
    
    // FIX: Regex check to ensure related list isn't duplicated
    // Escape the dots in the ID for regex: Favorite__c\.Contact__c
    const escapedId = relatedListId.replace(/\./g, '\\.');
    const listRegex = new RegExp(`<relatedList>\\s*${escapedId}\\s*<\\/relatedList>`);

    if (listRegex.test(content)) {
        console.log(`ℹ️  Related List '${relatedListId}' already on layout '${layoutName}'.`);
        return;
    }

    const relatedListXml = `
    <relatedLists>
        <fields>NAME</fields>
        <relatedList>${relatedListId}</relatedList>
    </relatedLists>`;

    // Insert before closing layout tag
    content = content.replace('</Layout>', `${relatedListXml}\n</Layout>`);
    
    fs.writeFileSync(layoutPath, content);
    console.log(`✅ Added Related List '${relatedListId}' to ${layoutName}`);
}

// ============================================================================
// 5. EXECUTION
// ============================================================================

console.log('🚀 Starting Automation Script...');

const ROOT_DIR = path.join(process.cwd(), 'force-app/main/default/objects');

// --- 1. PROPERTY OBJECT (Needed for Master-Detail) ---
console.log('\n--- Building Property Object ---');
const propPath = createObject(ROOT_DIR, 'Property', 'Property', 'Properties', { label: 'Property Name', type: 'Text' });
createFields(propPath, [
    { name: 'Price', label: 'Listing Price', type: 'Currency', required: true },
    { name: 'Address', label: 'Street Address', type: 'Text' }
]);
createTab('Property', ROOT_DIR, 'Custom57: Building Block');
createLayout('Property', ROOT_DIR);
createPermissionSet('Property', ROOT_DIR); 
addTabToApp('standard__Sales', 'Property', ROOT_DIR);


// --- 2. OFFER OBJECT ---
console.log('\n--- Building Offer Object ---');
const offerPath = createObject(ROOT_DIR, 'Offer', 'Offer', 'Offers', { label: 'Offer Name', type: 'AutoNumber', displayFormat: 'OF-{0000}' });
createFields(offerPath, [
    { name: 'Offer_Amount', label: 'Offer Amount', type: 'Currency' },
    { name: 'Target_Close_Date', label: 'Target Close Date', type: 'Date' }
]);
createTab('Offer', ROOT_DIR, 'Custom1: Heart');
createLayout('Offer', ROOT_DIR);
addFieldToLayout('Offer__c-Offer Layout', 'Offer_Amount__c', ROOT_DIR);
addFieldToLayout('Offer__c-Offer Layout', 'Target_Close_Date__c', ROOT_DIR);
createPermissionSet('Offer', ROOT_DIR); 
addTabToApp('standard__Sales', 'Offer', ROOT_DIR);


// --- 3. FAVORITES OBJECT ---
console.log('\n--- Building Favorites Object ---');
const favPath = createObject(ROOT_DIR, 'Favorite', 'Favorite', 'Favorites', { label: 'Favorite Name', type: 'Text' });

createFields(favPath, [
    // Lookup to Contact
    { 
        name: 'Contact',            
        label: 'Contact',           
        type: 'Lookup',
        referenceTo: 'Contact',     
        relationshipLabel: 'Favorites', 
        relationshipName: 'Favorites'
    },
    // Master-Detail to Property
    { 
        name: 'Property',            
        label: 'Property',           
        type: 'Master-Detail',       
        required: true,             
        referenceTo: 'Property__c',  
        relationshipLabel: 'Favorites', 
        relationshipName: 'Favorites'
    },
]);

createTab('Favorite', ROOT_DIR, 'Custom11: Star'); 
createLayout('Favorite', ROOT_DIR);
addFieldToLayout('Favorite__c-Favorite Layout', 'Contact__c', ROOT_DIR); 
addFieldToLayout('Favorite__c-Favorite Layout', 'Property__c', ROOT_DIR); 
createPermissionSet('Favorite', ROOT_DIR); 
addTabToApp('standard__Sales', 'Favorite', ROOT_DIR);


// --- 4. LAYOUT UPDATES (Related Lists) ---
console.log('\n--- Updating Contact Layout ---');
addRelatedListToLayout(
    'Contact-Contact %28Marketing%29 Layout', 
    'Favorite__c',   // Child Object
    'Contact__c',    // Lookup Field on Child
    ROOT_DIR
);

console.log('\n✨ All Objects Built Successfully.');