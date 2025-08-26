module.exports = {
  $randomString,
  $randomEmail,
  $randomFirstName,
  $randomLastName
};

function $randomString() {
  return Math.random().toString(36).substring(7);
}

function $randomEmail() {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'example.com'];
  const randomDomain = domains[Math.floor(Math.random() * domains.length)];
  return `user${Math.random().toString(36).substring(7)}@${randomDomain}`;
}

function $randomFirstName() {
  const names = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa', 'Robert', 'Emily', 'James', 'Maria'];
  return names[Math.floor(Math.random() * names.length)];
}

function $randomLastName() {
  const names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  return names[Math.floor(Math.random() * names.length)];
}