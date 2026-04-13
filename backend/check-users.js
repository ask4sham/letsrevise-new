const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const User = require('./models/User');
    const users = await User.find({}, 'email userType firstName lastName earnings');
    console.log('All users in database:');
    users.forEach(user => {
      console.log(`- ${user.email} (${user.userType}) → ${user.firstName} ${user.lastName}, Earnings: ${user.earnings ?? 0}`);
    });
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error:', err);
    mongoose.disconnect();
  });
