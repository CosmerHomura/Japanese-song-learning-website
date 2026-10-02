"""The same annotation endpoint may run in several FastAPI worker threads."""
import sys
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.services import annotation as service


class AnnotationConcurrencyTests(unittest.TestCase):
    def test_parallel_requests_keep_their_own_text_and_readings(self):
        lines = ["今日は日本語を勉強します。", "夏の空を見上げる。", "君と一緒に歩きます。", "明日は晴れるでしょう。"]
        with patch.object(service, "lookup_tomoshi_word", return_value=None):
            expected = {line: [token.model_dump() for token in service.annotate_text(line)] for line in lines}
            def annotate(line):
                return line, [token.model_dump() for token in service.annotate_text(line)]
            with ThreadPoolExecutor(max_workers=8) as workers:
                results = list(workers.map(annotate, lines * 16))
        for line, tokens in results:
            self.assertEqual(tokens, expected[line])
            self.assertEqual("".join(token["surface"] for token in tokens), line)


if __name__ == "__main__":
    unittest.main()
