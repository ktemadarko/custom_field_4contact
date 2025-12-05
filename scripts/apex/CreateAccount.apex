//Define the account
Account new_acc = new Account();
new_acc.Name = 'Get Cloudy';
new_acc.Phone = '775-555-5309';
new_acc.AccountNumber = 117;
new_AccountSite = 'Single Location';
new_acc.Type = 'Customer - Direct';
new_acc.Industry = 'Consulting';
new_acc.BillingCity = 'Reno';
new_acc.BillingState/Province = 'NV';

//Save it to the database
insert new_acc;

//Print the id to the debug log so we know it worked
System.debug('Created new Account: ' + new_acc.Name)