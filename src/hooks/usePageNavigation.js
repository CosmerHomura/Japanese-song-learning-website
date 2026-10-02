import { useCallback, useState } from 'react';
const pages = ['library', 'lesson', 'review'];
export default function usePageNavigation() {
  const [navigation, setNavigation] = useState({
    page: 'library',
    direction: 'initial'
  });
  const setActivePage = useCallback(page => {
    if (!pages.includes(page)) return;
    setNavigation(previous => previous.page === page ? previous : {
      page,
      direction: pages.indexOf(page) > pages.indexOf(previous.page) ? 'forward' : 'backward'
    });
  }, []);
  return {
    activePage: navigation.page,
    pageDirection: navigation.direction,
    setActivePage
  };
}
