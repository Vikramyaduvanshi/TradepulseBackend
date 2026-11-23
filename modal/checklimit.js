const { model } = require("mongoose");
const { Usermodel } = require("./modal");

const MAX = 8;                         // kitni requests allowed
const BLOCK_MS = 6 * 60 * 60 * 1000;    // limit full hone ke baad 6 ghante block


async function checkLimit(userId) {
  const now = new Date();

  // 1. Block khatam ho gaya to count reset karo
  await Usermodel.updateOne(
    { _id: userId, "limit.blockedUntil": { $ne: null, $lte: now } },
    { $set: { "limit.count": 0, "limit.blockedUntil": null } }
  );

  // 2. Abhi block me hai to mana kar do
  const blocked = await Usermodel.exists({
    _id: userId,
    "limit.blockedUntil": { $gt: now },
  });
  if (blocked) return false;

  // 3. Count badhao (atomic)
  const user = await Usermodel.findOneAndUpdate(
    { _id: userId },
    { $inc: { "limit.count": 1 } },
    { new: true }
  );

  // 4. Agar ye request MAX tak pahunchi, to block timer shuru karo
  if (user.limit.count >= MAX) {
    await Usermodel.updateOne(
      { _id: userId, "limit.blockedUntil": null },
      { $set: { "limit.blockedUntil": new Date(now.getTime() + BLOCK_MS) } }
    );
  }

  return true;
}




module.exports=checkLimit