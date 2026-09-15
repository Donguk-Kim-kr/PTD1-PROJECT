"""
PTD1 class_18.method_137 체크섬 알고리즘 - 파이썬 재구현

원본 ActionScript(class_18.as) 로직을 한 줄씩 그대로 옮긴 버전입니다.
서버가 loadAccount 응답의 ProfileID를 만들 때 이 함수를 그대로 쓰면 됩니다.
"""
import random


def _char_to_num(ch: str) -> int:
    """method_332: 문자 -> 숫자 (a=1,...,z=26, 숫자문자'1'~'9'도 1~9, '0'은 매핑 없음=0)"""
    if ch in ("a", "1"):
        return 1
    if ch in ("b", "2"):
        return 2
    if ch in ("c", "3"):
        return 3
    if ch in ("d", "4"):
        return 4
    if ch in ("e", "5"):
        return 5
    if ch in ("f", "6"):
        return 6
    if ch in ("g", "7"):
        return 7
    if ch in ("h", "8"):
        return 8
    if ch in ("i", "9"):
        return 9
    # j~z는 문자 전용 (10~26)
    mapping = {
        "j": 10, "k": 11, "l": 12, "m": 13, "n": 14, "o": 15, "p": 16,
        "q": 17, "r": 18, "s": 19, "t": 20, "u": 21, "v": 22, "w": 23,
        "x": 24, "y": 25, "z": 26,
    }
    return mapping.get(ch, 0)


def _num_to_char(n) -> str:
    """method_68: 숫자(문자열) -> 문자 (0=a,1=b,...,25=z)"""
    s = str(n)
    mapping = {
        "0": "a", "1": "b", "2": "c", "3": "d", "4": "e", "5": "f",
        "6": "g", "7": "h", "8": "i", "9": "j", "10": "k", "11": "l",
        "12": "m", "13": "n", "14": "o", "15": "p", "16": "q", "17": "r",
        "18": "s", "19": "t", "20": "u", "21": "v", "22": "w", "23": "x",
        "24": "y", "25": "z",
    }
    return mapping.get(s, "")


def _checksum(s: str) -> int:
    """method_150: 문자열의 각 문자를 숫자로 바꿔서 합산"""
    return sum(_char_to_num(ch) for ch in s)


def _random_fallback() -> str:
    """method_118: 검증 실패 시 반환하는 랜덤 8쌍 문자열 (문자+숫자)"""
    result = ""
    for _ in range(8):
        letter_num = int(random.random() * 26)
        result += _num_to_char(str(letter_num))
        result += str(int(random.random() * 10))
    return result


def method_137(current_save: str, trainer_id: int) -> str:
    """
    원본 ActionScript와 동일한 이름으로 유지.
    current_save: 세이브 문자열 (길이 정확히 14자여야 함)
    trainer_id: 333 ~ 99999 사이의 정수
    """
    loc3 = _checksum(current_save)

    if len(current_save) != 14:
        return _random_fallback()
    if loc3 == 0:
        return _random_fallback()
    if trainer_id < 333 or trainer_id > 99999:
        return _random_fallback()

    loc4 = trainer_id * loc3
    loc4 = loc4 * 14
    loc5 = str(loc4)
    loc6 = int(loc5[0])

    result = ""
    for digit_char in loc5:
        loc8 = int(digit_char) + loc6
        result += _num_to_char(loc8)
    return result


if __name__ == "__main__":
    # 간단한 자체 테스트 - 길이 14자 세이브 문자열 예시로 검증
    test_save = "abcdefghijklmn"  # 14자
    test_trainer_id = 12345

    print(f"세이브 문자열: {test_save} (길이: {len(test_save)})")
    print(f"TrainerID: {test_trainer_id}")
    result = method_137(test_save, test_trainer_id)
    print(f"ProfileID: {result}")

    # 검증 실패 케이스들
    print("\n--- 검증 실패 케이스 (매번 다른 랜덤값이 나와야 정상) ---")
    print("길이 13자:", method_137("short", 12345))
    print("TrainerID 범위 밖(1):", method_137(test_save, 1))
    print("TrainerID 범위 밖(999999):", method_137(test_save, 999999))