public class ContactService {
    //this class is used to create a contact
    public static void createContact(
        String var_targetName,
        String firstName,
        String lastName,
        String title,
        String phone,
        String email
    ) {
        //1. Find the account
        List<Account> findAccounts = [SELECT Id FROM Account WHERE Name = :var_targetName LIMIT 1];

        // Safety check: Did we find an account?
        if (findAccounts.size() == 0) {
            System.debug('ERROR: No Account found with name: ' + var_targetName);
            return;
        }
        // 2. Create the contact

        Contact newContact = new Contact();
        newContact.AccountId = findAccounts[0].Id;
        newContact.FirstName = firstName;
        newContact.LastName = lastName;
        newContact.Title = title;
        newContact.Phone = phone;
        newContact.Email = email;

        try {
            insert newContact;
            System.debug('SUCCESS! Created Contact: ' + newContact.FirstName + ' ' + newContact.LastName);
        } catch (DmlException e) {
            // This catches errors like "Required Field Missing" or "Duplicate Value"
            System.debug('ERROR: Could not create Contact.');
            System.debug('Details: ' + e.getMessage());
        }
    }
}
