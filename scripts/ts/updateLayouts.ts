// ============================================================================
// FILE: scripts/ts/updateLayouts.ts
// PURPOSE: Adds a new field to the first 2-column section of a Page Layout.
// ============================================================================
import * as fs from 'fs';
import * as path from 'path';

export function addFieldToLayout(
    layoutName: string, 
    fieldName: string, 
    rootDir: string
): void {
    
    const layoutsFolder = path.join(rootDir, '..', 'layouts');
    const layoutFileName = layoutName.endsWith('.layout-meta.xml') ? layoutName : `${layoutName}.layout-meta.xml`;
    const layoutPath = path.join(layoutsFolder, layoutFileName);

    // Safety check: Does the layout exist?
    if (!fs.existsSync(layoutPath)) {
        console.log(`❌ Warning: Layout '${layoutFileName}' not found.`);
        return;
    }

    let content = fs.readFileSync(layoutPath, 'utf8');

    // Duplicate check: Is the field already there?
    if (content.includes(`<field>${fieldName}</field>`)) {
        console.log(`ℹ️  Field '${fieldName}' already on layout '${layoutName}'.`);
        return;
    }

    // XML block for a new field in Edit mode
    const newFieldXml = `
                <layoutItems>
                    <behavior>Edit</behavior>
                    <field>${fieldName}</field>
                </layoutItems>`;

    // FIX: Use 'new RegExp' string syntax to avoid TypeScript parsing errors.
    // Note: We must double-escape the backslashes (\\s\\S).
    const regexPattern = "<layoutSections>[\\s\\S]*?<style>TwoColumns.*?</style>[\\s\\S]*?<layoutColumns>([\\s\\S]*?)</layoutColumns>";
    const twoColumnRegex = new RegExp(regexPattern);

    const match = content.match(twoColumnRegex);

    if (match) {
        const originalBlock = match[0];
        // Inject the new field at the end of the column
        const updatedBlock = originalBlock.replace('</layoutColumns>', `${newFieldXml}\n        </layoutColumns>`);
        content = content.replace(originalBlock, updatedBlock);
        fs.writeFileSync(layoutPath, content);
        console.log(`✅ Added '${fieldName}' to layout: ${layoutName}`);
    } else {
        console.log(`⚠️  Could not find a 2-column section in ${layoutName}.`);
    }
}