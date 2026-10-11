package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.User;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** 친구 찾기(닉네임 앞부분 검색) 전용. UserRepository 를 건드리지 않으려고 따로 둔다. */
public interface FriendUserSearchRepository extends Repository<User, Long> {
    @Query("select u from User u where lower(u.nickname) like lower(concat(:prefix, '%')) escape '!' "
            + "and u.id <> :excludeId order by u.nickname asc")
    List<User> searchByNicknamePrefix(
            @Param("prefix") String escapedPrefix,
            @Param("excludeId") Long excludeId,
            Pageable pageable
    );
}
