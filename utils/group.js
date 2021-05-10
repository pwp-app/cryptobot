const getGroupMemberNames = async (bot, groupId) => {
  const map = {};
  const list = await bot.getGroupMemberList(groupId);
  list.forEach((userInfo) => {
    map[userInfo.userId] = userInfo.username;
  });
  return map;
};

module.exports = {
  getGroupMemberNames,
};
