<template>
  <router-view />
  <van-tabbar route fixed placeholder safe-area-inset-bottom>
    <van-tabbar-item replace to="/today" icon="calendar-o">今日</van-tabbar-item>
    <van-tabbar-item replace to="/week" icon="bars">周计划</van-tabbar-item>
    <van-tabbar-item replace to="/library" icon="apps-o">食谱库</van-tabbar-item>
    <van-tabbar-item replace to="/profile" icon="setting-o">设置</van-tabbar-item>
  </van-tabbar>
</template>
