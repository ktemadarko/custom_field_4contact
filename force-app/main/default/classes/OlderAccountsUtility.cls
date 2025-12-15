public class OlderAccountsUtility {
    public static void updateOlderAccounts() {
        // Get the 5 oldest accounts
        Account[] oldAccounts = [SELECT Id, Description FROM Account ORDER BY CreatedDate ASC LIMIT 5];

        // Alternate method of declaring it apex [] means array and List means list but they do the same thing
        // List<Account> oldAccounts = [SELECT Id, Description FROM Account ORDER BY CreatedDate ASC LIMIT 5]
        // loop through them and update the Description field
        // "For every single Account inside the list oldAccounts, let's call the current one acct and do the following..."
        for (Account acct : oldAccounts) {
            acct.Description = 'Heritage Account';
        }
        // save the change you made
        update oldAccounts;
    }
}
