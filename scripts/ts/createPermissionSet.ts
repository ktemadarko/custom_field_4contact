// ============================================================================
// FILE: scripts/ts/createPermissionSet.ts
// PURPOSE: Generates a Permission Set XML to grant users access to the new object.
// ============================================================================
import * as fs from 'fs';
import * as path from 'path';

// Helper to determine API Name
function getApiName(objectName: string): string {
    const STANDARD_OBJECTS = ['Account', 'Contact', 'Opportunity', 'Lead', 'Case'];
    const isStandard = STANDARD_OBJECTS.includes(objectName);
    const hasSuffix = objectName.endsWith('__c');

    if (!isStandard && !hasSuffix) {
        return `${objectName}__c`;
    }
    return objectName;
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