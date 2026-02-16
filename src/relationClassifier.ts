/**
 * 关系分类器
 * 统一的关系识别和主题推荐逻辑
 */

import type { RelationType, ThemeType } from "./types";

// 关系分类关键词映射
export const RELATION_KEYWORDS: Record<RelationType, string[]> = {
  elder: [
    "爸",
    "妈",
    "父",
    "母",
    "爷",
    "奶",
    "外公",
    "外婆",
    "姥",
    "爹",
    "姑",
    "姨",
    "舅",
    "叔",
    "伯",
    "婆婆",
    "公公",
    "岳",
    "长辈",
    "大爷",
    "大妈",
    "阿姨",
  ],
  friend: [
    "发小",
    "朋友",
    "闺蜜",
    "兄弟",
    "哥们",
    "姐妹",
    "好友",
    "室友",
    "同学",
    "死党",
    "伙伴",
    "基友",
    "损友",
    "挚友",
  ],
  colleague: [
    "同事",
    "领导",
    "老板",
    "同僚",
    "上司",
    "下属",
    "合伙人",
    "搭档",
    "总监",
    "经理",
    "主管",
    "CEO",
  ],
  lover: [
    "老婆",
    "老公",
    "女朋友",
    "男朋友",
    "对象",
    "爱人",
    "媳妇",
    "另一半",
    "女友",
    "男友",
    "未婚",
    "恋人",
  ],
  junior: [
    "儿子",
    "女儿",
    "孩子",
    "侄子",
    "侄女",
    "外甥",
    "宝宝",
    "闺女",
    "小朋友",
    "弟弟",
    "妹妹",
    "学生",
  ],
  teacher: ["老师", "导师", "教授", "师父", "教练", "师傅"],
  client: ["客户", "甲方", "合作方", "商业伙伴", "合作伙伴"],
  general: [],
};

/**
 * 根据关系描述识别关系类型
 * @param relation - 关系描述字符串
 * @returns 关系类型
 */
export function classifyRelation(relation: string): RelationType {
  for (const [type, keywords] of Object.entries(RELATION_KEYWORDS)) {
    if (type === "general") continue;
    if (keywords.some((kw) => relation.includes(kw))) {
      return type as RelationType;
    }
  }
  return "general";
}

/**
 * 根据关系和背景信息推荐主题
 * 优先使用 classifyRelation 分类，然后映射到主题
 * @param relation - 关系描述
 * @param background - 背景信息（可选）
 * @returns 推荐的主题类型
 */
export function suggestTheme(
  relation: string,
  background: string = ""
): ThemeType {
  const relType = classifyRelation(relation);
  const text = `${relation} ${background}`.toLowerCase();

  // 根据关系类型映射到主题
  switch (relType) {
    case "elder":
      return "traditional"; // 长辈 -> 传统红金

    case "junior":
      // 孩子、女性晚辈 -> 粉色可爱
      if (
        text.match(
          /女儿|孙女|妹妹|姐姐|闺蜜|女朋友|老婆|妻子|孩子|小朋友|宝宝/
        )
      ) {
        return "cute";
      }
      return "modern"; // 其他晚辈 -> 现代科技

    case "colleague":
    case "client":
      return "modern"; // 职场 -> 现代科技

    case "lover":
      return "cute"; // 恋人 -> 粉色可爱

    case "teacher":
      return "elegant"; // 老师 -> 墨绿优雅

    case "friend":
      // 女性朋友 -> 粉色可爱
      if (text.match(/闺蜜|姐妹|女/)) {
        return "cute";
      }
      return "modern"; // 其他朋友 -> 现代科技

    default:
      // general: 根据背景细分
      if (text.match(/文艺|作家|艺术家|知识分子/)) {
        return "elegant";
      }
      if (
        text.match(
          /女儿|孙女|妹妹|姐姐|闺蜜|女朋友|老婆|妻子|孩子|小朋友|宝宝/
        )
      ) {
        return "cute";
      }
      if (text.match(/年轻|朋友|同学|兄弟|哥们|室友/)) {
        return "modern";
      }
      return "traditional"; // 默认传统红金
  }
}
