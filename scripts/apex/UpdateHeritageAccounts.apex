OlderAccountsUtility.updateOlderAccounts();
// To run this code I need to run the code below in the cli
//    sf apex run --file scripts/apex/UpdateHeritageAccounts.apex --target-org my_dev_org

// To check if it actually run
// sf data query --query "SELECT Name, CreatedDate, Description FROM Account ORDER BY CreatedDate ASC LIMIT 5" --target-org my_dev_org