// ============================================================================
// FILE: scripts/ts/updateLayouts.ts
// PURPOSE: Adds a field to the first 2-column section of a Page Layout
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