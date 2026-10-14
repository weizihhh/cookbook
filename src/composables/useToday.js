// 跨零点自愈的"今天":手机浏览器常驻后台过夜后,setup 里 todayStr() 求值一次的
// 常量会停留在昨天,导致记录/打卡/体重全部写错日期。此组合式返回模块级单例 ref,
// 每分钟比对一次、并在页面回到前台时立即比对;跨零点后所有依赖它的 computed
// 自动级联刷新。三处视图(今日/记录/添加弹层)共用同一实例。
import { ref } from 'vue'
import { todayStr } from '../utils/date'

const today = ref(todayStr())

function checkNow() {
  const t = todayStr()
  if (t !== today.value) today.value = t
}

if (typeof window !== 'undefined') {
  setInterval(checkNow, 60 * 1000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkNow()
  })
}

export function useToday() {
  return today
}
