package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.Protein;
import org.springframework.data.domain.Page; import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProteinRepository extends JpaRepository<Protein, Long> {
    // 목록에 작성자 닉네임을 쓰므로 작성자를 같이 가져온다(글마다 추가 조회 방지)
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"owner"})
    Page<Protein> findByNameContainingIgnoreCase(String name, Pageable pageable);

    @Override
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"owner"})
    Page<Protein> findAll(Pageable pageable);

    // 공동구매 목록(GroupBuyAccess 규칙과 같다). 작성자 · 짐을 함께 읽는다.
    // 검색어가 없으면 "" 를 넘긴다(:q is null 은 Postgres 가 null 매개변수 타입을 bytea 로 잡아 lower(bytea) 오류가 난다)
    String NAME_FILTER = " and lower(p.name) like lower(concat('%', :q, '%'))";

    /** 내가 볼 수 있는 전부: 전체 모집 + 짐 없는 글 + 내 짐들 글(운영자는 전부) */
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"owner", "gym"})
    @org.springframework.data.jpa.repository.Query("select p from Protein p left join p.gym g where (:admin = true"
            + " or p.visibility = com.ajou.muscleup.entity.GroupBuyVisibility.PUBLIC or g is null or g.id in :gymIds)" + NAME_FILTER)
    Page<Protein> searchVisible(@org.springframework.data.repository.query.Param("admin") boolean admin,
                                @org.springframework.data.repository.query.Param("gymIds") java.util.Collection<Long> gymIds,
                                @org.springframework.data.repository.query.Param("q") String q, Pageable pageable);

    /** "전체" 탭: 전체 모집 + 짐 없는 글 */
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"owner", "gym"})
    @org.springframework.data.jpa.repository.Query("select p from Protein p left join p.gym g where"
            + " (p.visibility = com.ajou.muscleup.entity.GroupBuyVisibility.PUBLIC or g is null)" + NAME_FILTER)
    Page<Protein> searchPublic(@org.springframework.data.repository.query.Param("q") String q, Pageable pageable);

    /** "우리 모임" 탭: 내 짐들에서 연 글(모집 범위 상관없이) */
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"owner", "gym"})
    @org.springframework.data.jpa.repository.Query("select p from Protein p join p.gym g where g.id in :gymIds" + NAME_FILTER)
    Page<Protein> searchInGyms(@org.springframework.data.repository.query.Param("gymIds") java.util.Collection<Long> gymIds,
                               @org.springframework.data.repository.query.Param("q") String q, Pageable pageable);
}
