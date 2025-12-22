const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const User = require('./models/User');
    const users = await User.find({}, 'email userType firstName lastName shamCoins');
    console.log('All users in database:');
    users.forEach(user => {
      console.log(\- \ (\): \ \, Coins: \\);
    });
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error:', err);
    mongoose.disconnect();
  });
