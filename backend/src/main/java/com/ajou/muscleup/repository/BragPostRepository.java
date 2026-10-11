package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.BragPost;
import com.ajou.muscleup.entity.BragVisibility;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;

public interface BragPostRepository extends JpaRepository<BragPost, Long> {
    Page<BragPost> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /**
     * 광장: 전체 공개 글 + 친구의 친구 공개 글 + 내 글. "우리 모임만"(GYM) 글은 그 짐 피드에서만 보인다(내 글 제외).
     * friendIds 가 비면 -1 하나를 넣어 부른다(in 절이 비지 않게).
     */
    @Query("""
      select p from BragPost p
      where p.visibility = :pub
         or (p.visibility = :friends and p.user.id in :friendIds)
         or p.user.id = :me
      order by p.createdAt desc
      """)
    Page<BragPost> findSquareFeed(
            @Param("me") Long me,
            @Param("friendIds") Collection<Long> friendIds,
            @Param("pub") BragVisibility pub,
            @Param("friends") BragVisibility friends,
            Pageable pageable
    );

    /** 한 짐 피드: 그 짐에 올린 글 중 내가 볼 수 있는 것. 멤버가 아니면 gymOnly 에 PUBLIC 을 넣어 GYM 글을 뺀다 */
    @Query("""
      select p from BragPost p
      where p.gym.id = :gymId
        and (p.visibility = :pub
          or p.visibility = :gymOnly
          or (p.visibility = :friends and p.user.id in :friendIds)
          or p.user.id = :me)
      order by p.createdAt desc
      """)
    Page<BragPost> findGymFeed(
            @Param("gymId") Long gymId,
            @Param("me") Long me,
            @Param("friendIds") Collection<Long> friendIds,
            @Param("pub") BragVisibility pub,
            @Param("gymOnly") BragVisibility gymOnly,
            @Param("friends") BragVisibility friends,
            Pageable pageable
    );
}
