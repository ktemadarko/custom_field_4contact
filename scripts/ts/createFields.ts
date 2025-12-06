import * as fs from 'fs';
import * as path from 'path';

// --- TYPES ---
export type FieldType = 'Text' | 'Number' | 'Currency' | 'Checkbox' | 'Date' | 'DateTime' | 'Email' | 'Percent' | 'Phone' | 'Url' | 'TextArea';

export interface FieldDefinition {
    name: string;
    type: FieldType;
    description: string;
}

// --- FUNCTION 1: Create Object ---
export function createObject(parentDirectory: string, objectName: string, label: string, pluralLabel: string): string {
    const objApiName = `${objectName}__c`;
    const objectFolder = path.join(parentDirectory, objApiName);
    const fieldsFolder = path.join(objectFolder, 'fields');

    if (!fs.existsSync(fieldsFolder)) {
        fs.mkdirSync(fieldsFolder, { recursive: true });
    }

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${objApiName}</fullName>
    <label>${label}</label>
    <pluralLabel>${pluralLabel}</pluralLabel>
    <deploymentStatus>Deployed</deploymentStatus>
    <sharingModel>ReadWrite</sharingModel>
    <nameField>
        <label>${label} Name</label>
        <type>Text</type>
    </nameField>
</CustomObject>`;

    fs.writeFileSync(path.join(objectFolder, `${objApiName}.object-meta.xml`), xmlContent);
    console.log(`✅ Created Object: ${objApiName}`);
    
    return fieldsFolder;
}

// --- FUNCTION 2: Create Fields ---
export function createFields(fieldsDir: string, fieldList: FieldDefinition[]): void {
    
    fieldList.forEach(field => {
        const apiName = `${field.name}__c`;
        const label = field.name.replace(/_/g, ' '); 

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
    <description>${field.description}</description>
    <required>false</required>
    ${extraTags}
</CustomField>`;

        fs.writeFileSync(path.join(fieldsDir, `${apiName}.field-meta.xml`), xmlContent);
        console.log(`   Created Field: ${apiName}`);
    });
}

// --- EXECUTION ---
if (require.main === module) {
    const ROOT_DIR = 'force-app/main/default/objects';

    const fieldsPath = createObject(ROOT_DIR, 'Property', 'Property', 'Properties');

    const myFields: FieldDefinition[] = [
        { name: 'Price', type: 'Currency', description: 'The listed sale price' },
        { name: 'Listing_Date', type: 'Date', description: 'Date went on market' },
        { name: 'Open_House_Time', type: 'DateTime', description: 'Next event time' },
        { name: 'Address', type: 'Text', description: 'Street address' },
        { name: 'Commission_Rate', type: 'Percent', description: 'Agent cut' },
        { name: 'Zillow_Link', type: 'Url', description: 'External link' }
    ];

    createFields(fieldsPath, myFields);
}