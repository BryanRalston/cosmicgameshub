# r16 player baseline

Game commit 3c8b130. Suite through a7cbeef for the functional and FPS rows. Lighthouse was run again after 15503f0 and still returned NO_FCP.

Result: 21/46 passed, 25 failed.

FPS is the median of 3 headed Chrome samples on port 9333, desktop 1440x900 dpr 1 and phone 390x844 dsf 2. The bar is desktop 520 bricks at 90 FPS and phone at 165. Lighthouse is simulate throttling, mobile, three runs. A background window reports no first paint, so those runs did not measure TBT.

| id | result | detail |
| --- | --- | --- |
| D-type-1 | FAIL | value "" != "fifteen"; move false -> true |
| D-type-2 | PASS | kept "mirror tower" |
| D-type-3 | FAIL | value "mirror tower" != "zxc rdt"; rot "0°" -> "90°"; drop false -> true |
| D-type-4 | FAIL | value "mirror tower" != "mirror towerrrr mmm fgh"; rot "90°" -> "0°"; mirror false -> true; tool false -> true; floor false -> true; drop true -> false |
| D-type-5 | PASS | kept "one brick" |
| D-type-6 | FAIL | value "" != "three far"; rot "0°" -> "180°"; tool false -> true; floor false -> true |
| D-type-7 | PASS | kept "six zebra" |
| D-type-8 | FAIL | value "six zebra" != "fifteen spread"; rot "180°" -> "270°"; tool true -> false; move false -> true; floor true -> false; paint false -> true |
| D-type-9 | FAIL | value "six zebra" != "qwerty mx"; rot "270°" -> "0°"; mirror false -> true; del false -> true; paint true -> false |
| P-type-1 | PASS | kept "fifteen" |
| P-type-2 | PASS | kept "mirror tower" |
| P-type-3 | PASS | kept "zxc rdt" |
| P-type-4 | PASS | kept "zxc rdtrrr mmm fgh" |
| P-type-5 | PASS | kept "one brick" |
| P-type-6 | PASS | kept "three far" |
| P-type-7 | PASS | kept "six zebra" |
| P-type-8 | PASS | kept "fifteen spread" |
| P-type-9 | PASS | kept "qwerty mx" |
| D-save-first | FAIL | page.waitForFunction: Timeout 4000ms exceeded. |
| P-save-first | PASS | saved and listed |
| thumbs | FAIL | row fill 37.4% outside 40-75 |
| D-brick-px | FAIL | brick 68.0 px |
| P-brick-px | FAIL | brick 178.0 px |
| D-plate-edge | PASS | edge rows 1 |
| P-plate-edge | FAIL | plate edge not in frame, edge rows 0 |
| ground-edge | PASS | no hard edge |
| D-stud-moire | FAIL | moire peaks 5 |
| D-zfight | PASS | stripe 0.007 |
| D-zoom-cursor | FAIL | brick did not grow 83.0 -> 51.0 |
| P-zoom-sign | PASS | 178 -> 244 -> 181 |
| panels-fit | FAIL | #buildToolPopup not on screen |
| D-delete-exit | FAIL | no brick at 729,400 count 1 |
| P-delete-exit | FAIL | color #ff2200 |
| esc-panels | FAIL | still open: desktop wall, desktop move, phone tutorial |
| native-dialogs | FAIL | clear confirm:Clear all bricks? / gallery trash confirm:Delete this build from gallery? |
| colors | FAIL | red lit {"h":50.05524861878569,"r":255,"g":225,"b":74} |
| D-click-90 | FAIL | offset 12.8 px |
| D-drag | PASS | drag ignored, click placed |
| D-share | FAIL | page.waitForFunction: Timeout 8000ms exceeded. |
| D-copy | PASS | copy ok |
| chrome-fit | FAIL | toast top 626.4 |
| P-chrome | FAIL | rotation pill covers the drawer handle |
| P-stud-scale | FAIL | pitch brick 6 plate 0 |
| boot-x5 | PASS | 5 boots clean |
| fps | PASS | desktop 520 median 163 [158,163,163] phone 520 median 165 [165,165,166] phone 1 median 165 [165,165,165] port 9333 |
| lighthouse | FAIL | NO_FCP. The audit did not paint, including after the debug window was brought to the foreground. |

