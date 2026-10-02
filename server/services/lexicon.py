# A compact local vocabulary improves the first-use experience. Sudachi still
# supplies readings and grammar metadata for arbitrary lyrics.
WORD_LEXICON = {
    "夢": {"meaning": "梦；梦想", "examples": ["夢を見る：做梦", "夢が叶う：梦想实现"]},
    "忘れる": {"meaning": "忘记；遗忘", "examples": ["名前を忘れる：忘记名字", "忘れられない：无法忘记"]},
    "物": {"meaning": "东西；物品", "examples": ["忘れ物：遗忘的物品", "物語：故事"]},
    "取る": {"meaning": "拿；取；获得", "examples": ["手に取る：拿在手中", "写真を撮る：拍照"]},
    "帰る": {"meaning": "回去；返回", "examples": ["家に帰る：回家", "元に帰る：回到原状"]},
    "夜": {"meaning": "夜晚", "examples": ["夜中：深夜", "夜が明ける：天亮"]},
    "言う": {"meaning": "说；表达", "examples": ["そう言う：那样说", "言えない：不说"]},
    "見る": {"meaning": "看；观看；尝试", "examples": ["夢を見る：做梦", "見てみる：试着看看"]},
    "会う": {"meaning": "见面；相遇", "examples": ["友達に会う：见朋友", "また会おう：下次再见"]},
    "君": {"meaning": "你（较亲近的称呼）", "examples": ["君のこと：关于你", "君と：和你一起"]},
    "夏": {"meaning": "夏天；夏季", "examples": ["夏休み：暑假", "夏になる：到了夏天"]},
    "春": {"meaning": "春天；春季", "examples": ["春が来る：春天来了", "春風：春风"]},
    "秋": {"meaning": "秋天；秋季", "examples": ["秋になる：到了秋天", "秋の空：秋日的天空"]},
    "冬": {"meaning": "冬天；冬季", "examples": ["冬休み：寒假", "冬が来る：冬天来了"]},
    "追う": {"meaning": "追赶；追逐", "examples": ["夢を追う：追逐梦想", "後を追う：追在后面"]},
    "接ぐ": {"meaning": "连接；衔接；接上", "examples": ["言葉を接ぐ：接着说话", "次に接ぐ：接到下一项"]},
    "時間": {"meaning": "时间；钟点", "examples": ["時間がない：没有时间", "時間だから：因为到时间了"]},
    "行く": {"meaning": "去；前往；进展", "examples": ["家に行く：去家里", "行こう：一起去吧"]},
    "私": {"meaning": "我；我自己", "examples": ["私のこと：关于我", "私は：至于我"]},
    "また": {"meaning": "又；再次；还", "examples": ["また会う：再次见面", "またね：再见"]},
}

GRAMMAR_PHRASES = {
    ("だ", "から"): {
        "surface": "だから",
        "reading": "だから",
        "meaning": "所以；因此（表示原因、理由或顺接）",
        "examples": ["時間だから行く：因为到时间了，所以要走", "だから言った：所以我才说过"],
        "part_of_speech": "接续词・语法表达",
    },
}
