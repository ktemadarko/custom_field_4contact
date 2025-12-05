//Define the account
Account new_acc = new Account();
new_acc.Name = 'Get Cloudy';
new_acc.Phone = '775-555-5309';
new_acc.AccountNumber = '117';
new_acc.Site = 'Single Location';
new_acc.Type = 'Customer - Direct';
new_acc.Industry = 'Consulting';
new_acc.BillingCity = 'Reno';


// 2. CHECK: Does the "BillingStateCode" field exist in this Org?
// We ask the Schema (Metadata) Map directly.
Boolean hasCountryPicklists = Schema.SObjectType.Account.fields.getMap().containsKey('BillingStateCode');

// 3. BRANCH: Set the address based on the setting
if (hasCountryPicklists) {
    // SYSTEM IS STRICT (Picklists Enabled)
    System.debug('State/Country Picklists are ON. Using ISO Codes.');
    
    // We use .put() so the code doesn't crash if these fields don't exist
    new_acc.put('BillingStateCode', 'NV');
    
} else {
    // SYSTEM IS LOOSE (Text Fields)
    System.debug('State/Country Picklists are OFF. Using Text.');
    new_acc.BillingState = 'Nevada';
}

// 4. SAVE: Use Try/Catch to handle any other errors (like Validation Rules)
try {
    insert new_acc;
    System.debug('SUCCESS! Created Account: ' + new_acc.Name);
} catch (DmlException e) {
    // This catches errors like "Required Field Missing" or "Duplicate Value"
    System.debug('ERROR: Could not create Account.');
    System.debug('Details: ' + e.getMessage());
}
