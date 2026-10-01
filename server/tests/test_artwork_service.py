import unittest
from unittest.mock import patch

from server.services.artwork import find_song_artwork


class ArtworkServiceTests(unittest.TestCase):
    def test_matches_title_and_artist_without_http_route_state(self):
        with patch('server.services.artwork.fetch_itunes_songs', return_value=[
            {'trackName': '別の曲', 'artistName': '作者', 'artworkUrl100': 'https://example.com/wrong.jpg'},
            {'trackName': 'うた', 'artistName': '作者', 'artworkUrl100': 'https://example.com/100x100bb.jpg', 'trackViewUrl': 'https://example.com/song'},
        ]):
            result = find_song_artwork('うた (TV SIZE)', '作者')
        self.assertEqual(result['artwork_url'], 'https://example.com/600x600bb.jpg')
        self.assertEqual(result['provider'], 'Apple Music')

    def test_empty_or_unrelated_results_have_no_artwork(self):
        with patch('server.services.artwork.fetch_itunes_songs', return_value=[]):
            self.assertEqual(find_song_artwork('うた'), {})
        self.assertEqual(find_song_artwork(''), {})
